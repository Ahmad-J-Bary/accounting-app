//! Phase 1 — the opening window is the single-posting boundary for BOTH sides
//! of the ledger:
//!
//!   1. Partner balance edits (customer / supplier update) are deferred to the
//!      migration while the window is open: the linked account stays static and
//!      no 53-adjustment journal is posted, so the same balance can never be
//!      posted twice (R1). After the window closes behaviour is unchanged.
//!   2. Inventory opening enters the migration statement with a SINGLE ledger
//!      posting: the OpeningBalance invoice still creates its real
//!      MovementType::OpeningBalance movement and lot, but its
//!      MaterialOpeningBalance journal is deferred while the window is open —
//!      the migration's own opening lines carry the stock (Dr) and its
//!      balance-equity leg, so Inventory reconciles against the GL and appears
//!      in the Opening Position with exactly one posting.

use std::str::FromStr;
use std::sync::Arc;

use application::dto::customer_dto::{CreateCustomerRequest, UpdateCustomerRequest};
use application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceLineDto};
use application::dto::supplier_dto::CreateSupplierRequest;
use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::ports::supplier_repository::SupplierRepository;
use application::use_cases::customer::{
    CreateCustomerUseCase, UpdateCustomerUseCase,
};
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput,
    SaveOpeningItemsCommand,
};
use application::use_cases::opening_balance::{
    ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase, GetOpeningReconciliationUseCase,
    KIND_INVENTORY, LockOpeningBalanceUseCase, PostOpeningBalanceUseCase, SaveOpeningItemsUseCase,
    ValidateOpeningBalanceUseCase,
};
use application::use_cases::supplier::CreateSupplierUseCase;
use application::use_cases::unified_invoice::{
    CreateInvoiceUseCase, PostInvoiceDependencies, PostInvoiceUseCase,
};
use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
use domain::inventory::material::Material;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteAssetRepository, SqliteCategoryRepository,
    SqliteCurrencyRepository, SqliteCustomerRepository, SqliteExchangeRateRepository,
    SqliteInventoryLotRepository, SqliteJournalEntryRepository, SqliteMaterialRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqliteSettingsRepository, SqliteStockMovementRepository, SqliteSupplierRepository,
    SqliteUnifiedInvoiceRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_opening_window_deferral_{}.sqlite", uuid::Uuid::new_v4()));
    let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
        .unwrap()
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();
    let pool: Arc<sqlx::SqlitePool> = Arc::new(pool);
    run_migrations(&pool).await.unwrap();
    let currency_repo = Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let base = domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
    currency_repo.save(&base).await.unwrap();
    currency_repo.set_base_currency("S").await.unwrap();
    pool
}

async fn set_start_mode(pool: &Arc<sqlx::SqlitePool>, mode: &str) {
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let mut settings = settings_repo.get().await.unwrap();
    settings.accounting_start_mode = mode.into();
    settings_repo.save(&settings).await.unwrap();
}

async fn account_id_by_code(pool: &sqlx::SqlitePool, code: &str) -> AccountId {
    let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_one(pool)
        .await
        .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

async fn save_account(
    pool: &Arc<sqlx::SqlitePool>,
    code: &str,
    purpose: AccountPurpose,
    account_type: AccountType,
) -> AccountId {
    let account = Account::new(
        code.to_string(),
        format!("حساب {}", code),
        format!("Account {}", code),
        account_type,
        None,
        AccountCategory::Detail,
        3,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::ZERO,
        domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true),
        Decimal::ONE,
        None,
    )
    .unwrap()
    .with_purpose(purpose);
    let id = account.id;
    SqliteAccountRepository::new(pool.clone()).save(&account).await.unwrap();
    id
}

/// A draft migration opens the window (cash 122 / equity 52 pattern reused by
/// the existing critical tests, balanced so the draft is never a blocker).
async fn open_window(pool: &Arc<sqlx::SqlitePool>) -> String {
    let cash = account_id_by_code(pool, "122").await;
    let equity = account_id_by_code(pool, "52").await;
    let draft = CreateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
    )
    .execute(CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: None,
        source_reference: None,
        lines: vec![
            OpeningLineInput { account_id: cash.to_string(), amount: "1000".into(), description: None },
            OpeningLineInput { account_id: equity.to_string(), amount: "1000".into(), description: None },
        ],
    })
    .await
    .expect("create draft migration");
    draft.0.id
}

/// Number of journal lines ever posted against an account (live ledger truth).
async fn journal_line_count(pool: &sqlx::SqlitePool, account_id: &AccountId) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines WHERE account_id = ?")
        .bind(account_id.0.to_string())
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn stored_account_balance(pool: &Arc<sqlx::SqlitePool>, account_id: &AccountId) -> Decimal {
    let balance: String = sqlx::query_scalar("SELECT balance FROM accounts WHERE id = ?")
        .bind(account_id.0.to_string())
        .fetch_one(&**pool)
        .await
        .unwrap();
    Decimal::from_str(&balance).unwrap()
}

// ---------------------------------------------------------------------------
// Test 1 — updating a customer balance while the window is open defers the
// 53-adjustment journal and keeps the linked account static, while the entity
// still carries the edited opening balance (the wizard derivation input).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn customer_update_defers_adjustment_while_window_open() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let _migration_id = open_window(&pool).await;

    let customer_repo: Arc<dyn CustomerRepository> =
        Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    // Create during the window: static account, no per-entity opening journal.
    let create = CreateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "C1".into(),
        name: "عميل أول المدة".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: Some("500".into()),
        credit: None,
        opening_balance: Some("500".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer during window");

    let account_id = create.account_id.clone().expect("customer linked account");
    let account = account_repo.find_by_id(&AccountId::from_str(&account_id).unwrap()).await.unwrap().unwrap();
    assert_eq!(account.balance, Decimal::ZERO, "account is static zero during the window");

    // Update the balance + opening balance DURING the window.
    let updated = UpdateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(UpdateCustomerRequest {
        id: create.id.clone(),
        code: create.code.clone(),
        name: "عميل أول المدة".into(),
        phone: None,
        address: None,
        account_id: Some(account_id.clone()),
        debit: Some("800".into()),
        credit: None,
        opening_balance: Some("800".into()),
        currency: Some("S".into()),
        notes: None,
        is_active: true,
    })
    .await
    .expect("update customer during window");

    assert_eq!(updated.opening_balance, "800", "entity opening balance carries the edit");
    assert_eq!(
        stored_account_balance(&pool, &AccountId::from_str(&account_id).unwrap()).await,
        Decimal::ZERO,
        "linked account stays static while the migration owns the ledger"
    );
    assert_eq!(
        journal_line_count(&pool, &AccountId::from_str(&account_id).unwrap()).await,
        0,
        "no 53-adjustment journal was posted while the window is open"
    );
}

// ---------------------------------------------------------------------------
// Test 2 — the same deferral applies to supplier balance edits.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn supplier_update_defers_adjustment_while_window_open() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let _migration_id = open_window(&pool).await;

    let supplier_repo: Arc<dyn SupplierRepository> =
        Arc::new(SqliteSupplierRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    let create = CreateSupplierUseCase::new(
        supplier_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateSupplierRequest {
        code: "S1".into(),
        name: "مورد أول المدة".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: None,
        credit: Some("600".into()),
        opening_balance: Some("600".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create supplier during window");

    let account_id = create.account_id.clone().expect("supplier linked account");
    let account_id_typed = AccountId::from_str(&account_id).unwrap();

    application::use_cases::supplier::UpdateSupplierUseCase::new(
        supplier_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(application::dto::supplier_dto::UpdateSupplierRequest {
        id: create.id.clone(),
        code: create.code.clone(),
        name: "مورد أول المدة".into(),
        phone: None,
        address: None,
        account_id: Some(account_id.clone()),
        debit: None,
        credit: Some("950".into()),
        opening_balance: Some("950".into()),
        currency: Some("S".into()),
        notes: None,
    })
    .await
    .expect("update supplier during window");

    assert_eq!(stored_account_balance(&pool, &account_id_typed).await, Decimal::ZERO);
    assert_eq!(journal_line_count(&pool, &account_id_typed).await, 0);
}

// ---------------------------------------------------------------------------
// Test 3 — positive control: OUTSIDE the window the update posts the
// 53-adjustment journal and the account follows the balance (NewCompany
// baseline).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn customer_update_posts_adjustment_outside_window() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let customer_repo: Arc<dyn CustomerRepository> =
        Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    // A balance-less customer has no opening journal yet (source free), so the
    // first real balance change is a legitimate fresh adjustment.
    let created = CreateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "C2".into(),
        name: "عميل جديد".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: None,
        credit: None,
        opening_balance: Some("0".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer outside window");

    let account_id = created.account_id.clone().expect("linked account");
    let account_id_typed = AccountId::from_str(&account_id).unwrap();
    assert_eq!(stored_account_balance(&pool, &account_id_typed).await, Decimal::ZERO);
    assert_eq!(journal_line_count(&pool, &account_id_typed).await, 0, "no opening journal for a zero balance");

    application::use_cases::customer::UpdateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(UpdateCustomerRequest {
        id: created.id.clone(),
        code: created.code.clone(),
        name: "عميل جديد".into(),
        phone: None,
        address: None,
        account_id: Some(account_id.clone()),
        debit: Some("900".into()),
        credit: None,
        opening_balance: Some("900".into()),
        currency: Some("S".into()),
        notes: None,
        is_active: true,
    })
    .await
    .expect("update customer outside window");

    assert_eq!(stored_account_balance(&pool, &account_id_typed).await, Decimal::from(900));
    let adjustment_journals: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id = ? AND journal_type = 'AccountOpeningBalance'",
    )
    .bind(&created.id)
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(adjustment_journals, 1, "the update adjustment is a real posted journal");
}

// ---------------------------------------------------------------------------
// Test 4 — inventory opening DURING the window: the invoice still creates the
// OpeningBalance movement + lot, but its MaterialOpeningBalance journal is
// deferred; the migration statement carries the stock (Dr) and reconciles the
// Inventory sub-ledger against the GL with exactly one ledger posting.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn inventory_opening_in_statement_posts_once_and_reconciles() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let inventory = save_account(&pool, "1905", AccountPurpose::Inventory, AccountType::Assets).await;
    let equity = save_account(&pool, "1906", AccountPurpose::General, AccountType::Equity).await;

    let material = Material::new(
        "مادة مخزون أول المدة".into(),
        "M-INV-ST".into(),
        "M-INV-ST".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    SqliteMaterialRepository::new(pool.clone()).save(&material).await.unwrap();

    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let item_repo = Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let posting_repo = Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    // 1) Draft migration declares the stock: Dr inventory 500 / Cr equity 500.
    let draft = CreateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
    )
    .execute(CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: None,
        source_reference: None,
        lines: vec![
            OpeningLineInput { account_id: inventory.to_string(), amount: "500".into(), description: None },
            OpeningLineInput { account_id: equity.to_string(), amount: "500".into(), description: None },
        ],
    })
    .await
    .expect("create draft migration");
    let migration_id = draft.0.id.clone();

    // 2) Save the Inventory sub-ledger link (real material) + reconcile.
    SaveOpeningItemsUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        Arc::new(SqliteCustomerRepository::new(pool.clone())),
        Arc::new(SqliteSupplierRepository::new(pool.clone())),
        Arc::new(SqliteMaterialRepository::new(pool.clone())),
        Arc::new(SqliteAssetRepository::new(pool.clone())),
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: migration_id.clone(),
        items: vec![OpeningItemInput {
            kind: KIND_INVENTORY.to_string(),
            entity_id: material.id.to_string(),
            reference: None,
            amount: "500".into(),
            qty: "10".into(),
        }],
    })
    .await
    .expect("save inventory sub-ledger item");

    let recon = GetOpeningReconciliationUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("reconciliation computes");
    assert!(recon.all_reconciled, "inventory sub-ledger = GL must reconcile");
    let inv_row = recon.rows.iter().find(|r| r.key == "Inventory").expect("inventory row");
    assert_eq!(inv_row.subledger, dec!(500));
    assert_eq!(inv_row.general_ledger, dec!(500));

    // 3) Post the OpeningBalance invoice DURING the window: movement + lot yes,
    //    MaterialOpeningBalance journal deferred (single posting).
    post_opening_invoice(&pool, &material, migration_repo.clone()).await;

    let movements: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM stock_movements")
        .fetch_one(&*pool).await.unwrap();
    assert_eq!(movements, 1, "movement is created even though the journal is deferred");
    let movement_type: String = sqlx::query_scalar("SELECT movement_type FROM stock_movements")
        .fetch_one(&*pool).await.unwrap();
    assert_eq!(movement_type, "OpeningBalance");
    let lots: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_lots")
        .fetch_one(&*pool).await.unwrap();
    assert_eq!(lots, 1, "lot is created through the existing inventory module");
    let deferred: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'MaterialOpeningBalance'",
    )
    .fetch_one(&*pool).await.unwrap();
    assert_eq!(deferred, 0, "MaterialOpeningBalance journal is deferred to the migration (R1)");

    // 4) Validate → Approve → Post: the migration journal carries the stock once.
    ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(migration_id.clone(), "tester".into())
    .await
    .expect("reconciled inventory draft must validate");

    ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(migration_id.clone(), "approver".into())
        .await
        .expect("approve");

    let posted = PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(migration_id.clone())
    .await
    .expect("approved inventory migration must post");
    assert_eq!(posted.debit_total, posted.credit_total);

    let migration_journals: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id = ?",
    )
    .bind(format!("opening_balance:{migration_id}"))
    .fetch_one(&*pool).await.unwrap();
    assert_eq!(migration_journals, 1, "exactly one migration journal");
    let material_journals: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'MaterialOpeningBalance'",
    )
    .fetch_one(&*pool).await.unwrap();
    assert_eq!(material_journals, 0, "never a second MaterialOpeningBalance posting");

    // Live ledger: stock landed exactly once (Dr +500) via the migration journal.
    let stock_balance: f64 = sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL) - CAST(credit_base AS REAL)), 0.0)
         FROM journal_lines WHERE account_id = ?",
    )
    .bind(inventory.0.to_string())
    .fetch_one(&*pool).await.unwrap();
    assert!((stock_balance - 500.0).abs() < 0.01, "stock ledger = migration journal line only (got {stock_balance})");

    // 5) Lock closes cleanly (no stray 53 balance — the invoice journal was
    //    never posted, the migration carries the whole statement).
    let locked = LockOpeningBalanceUseCase::new(
        migration_repo,
        item_repo,
        account_repo,
        journal_repo,
    )
    .execute(migration_id.clone())
    .await
    .expect("posted inventory migration must lock");
    assert_eq!(locked.0.status, domain::accounting::MigrationStatus::Locked);
}

async fn post_opening_invoice(
    pool: &Arc<sqlx::SqlitePool>,
    material: &Material,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
) {
    let unified_repo = Arc::new(SqliteUnifiedInvoiceRepository::new(pool.clone()));
    let customer_repo = Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let supplier_repo = Arc::new(SqliteSupplierRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let material_repo: Arc<dyn MaterialRepository> =
        Arc::new(SqliteMaterialRepository::new(pool.clone()));
    let category_repo = Arc::new(SqliteCategoryRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    let invoice = CreateInvoiceUseCase::new(
        unified_repo.clone(),
        customer_repo.clone(),
        supplier_repo.clone(),
        account_repo.clone(),
        material_repo,
        category_repo,
        journal_repo.clone(),
        opening_migration_repo.clone(),
    )
    .execute(CreateInvoiceRequest {
        invoice_number: "".into(),
        invoice_type: "OpeningBalance".into(),
        customer_id: None,
        customer_name: None,
        supplier_id: None,
        supplier_name: None,
        lines: vec![InvoiceLineDto {
            id: String::new(),
            material_id: material.id.to_string(),
            material_name: Some(material.name.clone()),
            barcode: None,
            code: None,
            category_name: None,
            quantity: "10".into(),
            unit_id: None,
            conversion_factor: None,
            unit_price: "50".into(),
            unit_price_v2: None,
            purchase_price: Some("50".into()),
            purchase_price_v2: None,
            retail_price: None,
            retail_price_v2: None,
            wholesale_price: None,
            wholesale_price_v2: None,
            semi_wholesale_price: None,
            semi_wholesale_price_v2: None,
            minimum_stock: None,
            warehouse_id: None,
            expiry_date: None,
            notes: None,
            discount_percent: "0".into(),
            unit_price_original: None,
            purchase_price_original: None,
            profit_amount_original: None,
        }],
        tax_amount: "0".into(),
        discount_amount: "0".into(),
        extra_costs: None,
        payment_method: "Deferred".into(),
        amount_paid: "0".into(),
        issued_at: chrono::Utc::now().to_rfc3339(),
        currency_code: "S".into(),
        exchange_rate: "1".into(),
        notes: Some("بضاعة أول المدة".into()),
    })
    .await
    .expect("create opening balance invoice");

    PostInvoiceUseCase::new(PostInvoiceDependencies {
        repo: unified_repo,
        movement_repo: Arc::new(SqliteStockMovementRepository::new(pool.clone())),
        lot_repo: Arc::new(SqliteInventoryLotRepository::new(pool.clone())),
        journal_repo: journal_repo.clone(),
        account_repo: account_repo.clone(),
        customer_repo,
        supplier_repo,
        material_repo: Arc::new(SqliteMaterialRepository::new(pool.clone())),
        category_repo: Arc::new(SqliteCategoryRepository::new(pool.clone())),
        currency_repo: Arc::new(SqliteCurrencyRepository::new(pool.clone())),
        exchange_rate_repo: Arc::new(SqliteExchangeRateRepository::new(pool.clone())),
        opening_migration_repo,
    })
    .execute(invoice.id)
    .await
    .expect("post opening balance invoice");
}