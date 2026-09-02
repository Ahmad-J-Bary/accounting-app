//! No remaining opening duplication (One Company Model).
//!
//! Covered here:
//! - Inventory opening goes through the EXISTING unified-invoice module
//!   (invoice_type = OpeningBalance). Posting it creates exactly one
//!   MovementType::OpeningBalance stock movement + exactly one
//!   MaterialOpeningBalance journal and its inventory lot — the opening is
//!   carried as an opening movement on the existing stock/invoice entities,
//!   never by a separate opening-inventory service (the old
//!   RecordOpeningStockUseCase, which posted its own duplicate journal, is gone).
//! - Creating a Chart of Accounts account while a migration window is open
//!   defers the per-account AccountOpeningBalance journal (static zero), the
//!   same treatment the company lifecycle applies to customer/supplier create, so the same
//!   balance can never be posted twice (R1). After the window closes behaviour
//!   is unchanged (NewCompany baseline).

use std::str::FromStr;
use std::sync::Arc;

use application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceLineDto};
use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::account::types::CreateAccountCommand;
use application::use_cases::account::CreateAccountUseCase;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::OpeningLineInput;
use application::use_cases::opening_balance::CreateOpeningBalanceUseCase;
use application::use_cases::unified_invoice::{
    CreateInvoiceUseCase, PostInvoiceDependencies, PostInvoiceUseCase,
};
use domain::accounting::account::{AccountCategory, AccountType};
use domain::inventory::material::Material;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCategoryRepository, SqliteCurrencyRepository,
    SqliteCustomerRepository, SqliteExchangeRateRepository, SqliteInventoryLotRepository,
    SqliteJournalEntryRepository, SqliteMaterialRepository, SqliteOpeningMigrationRepository,
    SqliteSettingsRepository, SqliteStockMovementRepository, SqliteSupplierRepository,
    SqliteUnifiedInvoiceRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_opening_no_duplication_{}.sqlite",
        uuid::Uuid::new_v4()
    ));
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

async fn create_draft_migration(pool: &Arc<sqlx::SqlitePool>) -> String {
    let cash = account_id_by_code(pool, "122").await;
    let equity = account_id_by_code(pool, "52").await;
    let migration_repo = Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let case = CreateOpeningBalanceUseCase::new(migration_repo, account_repo, settings_repo);
    let result = case
        .execute(
            application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
                cutover_date: chrono::Utc::now().to_rfc3339(),
                notes: None,
                source_system: None,
                source_reference: None,
                lines: vec![
                    OpeningLineInput {
                        account_id: cash.to_string(),
                        amount: "1000".into(),
                        description: None,
                    },
                    OpeningLineInput {
                        account_id: equity.to_string(),
                        amount: "1000".into(),
                        description: None,
                    },
                ],
            },
        )
        .await
        .expect("create migration");
    result.0.id
}

async fn create_material(pool: &Arc<sqlx::SqlitePool>) -> Material {
    let material = Material::new(
        "مادة أول المدة".into(),
        "M-OPENING".into(),
        "M-OPENING".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    let material_repo = SqliteMaterialRepository::new(pool.clone());
    material_repo.save(&material).await.unwrap();
    material
}

async fn post_opening_balance_invoice(pool: &Arc<sqlx::SqlitePool>, material: &Material) {
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
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    let invoice = CreateInvoiceUseCase::new(
        unified_repo.clone(),
        customer_repo.clone(),
        supplier_repo.clone(),
        account_repo.clone(),
        material_repo,
        category_repo,
        journal_repo.clone(),
        migration_repo,
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
        opening_migration_repo: Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
    })
    .execute(invoice.id)
    .await
    .expect("post opening balance invoice");
}

// ---------------------------------------------------------------------------
// Test 1 — Inventory opening = existing unified-invoice module + opening
// movement. No separate opening-inventory service; a single OpeningBalance
// stock movement and a single MaterialOpeningBalance journal are produced.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn inventory_opening_posts_one_movement_and_one_journal_via_existing_module() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let material = create_material(&pool).await;
    post_opening_balance_invoice(&pool, &material).await;

    // Exactly one stock movement, of the opening-movement type, on the real material.
    let movement_rows: Vec<(String, String)> =
        sqlx::query_as("SELECT material_id, movement_type FROM stock_movements")
            .fetch_all(&*pool)
            .await
            .unwrap();
    assert_eq!(
        movement_rows.len(),
        1,
        "exactly one stock movement for the opening"
    );
    assert_eq!(
        movement_rows[0].0,
        material.id.to_string(),
        "movement belongs to the real material"
    );
    assert_eq!(
        movement_rows[0].1, "OpeningBalance",
        "opening carries the OpeningBalance movement type"
    );

    // Exactly one MaterialOpeningBalance journal (no duplicate service journal).
    let opening_journal_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries
         WHERE journal_type IN ('MaterialOpeningBalance', 'AccountOpeningBalance', 'CashOpeningBalance')",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(
        opening_journal_count, 1,
        "exactly one opening journal, no second posting path"
    );

    let material_opening_journals: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'MaterialOpeningBalance'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(material_opening_journals, 1);

    // The inventory lot is produced through the existing inventory-lots module.
    let lot_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inventory_lots")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(
        lot_count, 1,
        "opening creates its lot through the existing inventory module"
    );
}

// ---------------------------------------------------------------------------
// Test 2 — Creating a CoA account while the migration window is open defers the
// per-account AccountOpeningBalance journal (static zero). After the window
// closes the journal is posted exactly as before (NewCompany baseline).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn account_create_defers_opening_journal_while_window_open() {
    // ---- Window open (ExistingCompany migration in Draft): static zero, no journal
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    create_draft_migration(&pool).await;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let assets_root = account_id_by_code(&pool, "1").await;

    let cmd = |code: &str| CreateAccountCommand {
        code: code.into(),
        name_ar: "حساب اختبار افتتاحي".into(),
        name_en: "Opening Test Account".into(),
        account_type: AccountType::Assets,
        parent_id: Some(assets_root),
        category: AccountCategory::Detail,
        level: 2,
        opening_balance: "1000".into(),
        notes: None,
        linked_customer_id: None,
        linked_supplier_id: None,
        phone: None,
        address: None,
        debit: Some("1000".into()),
        credit: None,
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
    };

    let during = CreateAccountUseCase::new(
        account_repo.clone(),
        journal_repo.clone(),
        None,
        None,
        currency_repo.clone(),
        migration_repo.clone(),
    )
    .execute(cmd("1299"))
    .await
    .expect("create account during window");

    assert_eq!(
        during.opening_balance,
        Decimal::ZERO,
        "account must be static zero during the window"
    );
    let during_lines: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines WHERE account_id = ?")
            .bind(during.id.0.to_string())
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(
        during_lines, 0,
        "per-account opening journal must be deferred to the migration"
    );

    // ---- Window closed (NewCompany): the same use case posts the journal as before.
    let pool2 = build_pool().await;
    set_start_mode(&pool2, "NewCompany").await;

    let account_repo2: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool2.clone()));
    let journal_repo2: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool2.clone()));
    let currency_repo2: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool2.clone()));
    let migration_repo2: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool2.clone()));
    let assets_root2 = account_id_by_code(&pool2, "1").await;

    let after = CreateAccountUseCase::new(
        account_repo2,
        journal_repo2.clone(),
        None,
        None,
        currency_repo2,
        migration_repo2,
    )
    .execute(CreateAccountCommand {
        code: "1299".into(),
        name_ar: "حساب اختبار افتتاحي".into(),
        name_en: "Opening Test Account".into(),
        account_type: AccountType::Assets,
        parent_id: Some(assets_root2),
        category: AccountCategory::Detail,
        level: 2,
        opening_balance: "1000".into(),
        notes: None,
        linked_customer_id: None,
        linked_supplier_id: None,
        phone: None,
        address: None,
        debit: Some("1000".into()),
        credit: None,
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
    })
    .await
    .expect("create account outside window");

    assert_eq!(
        after.opening_balance,
        Decimal::from(1000),
        "opening stays static outside the window"
    );
    let after_lines: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines WHERE account_id = ?")
            .bind(after.id.0.to_string())
            .fetch_one(&*pool2)
            .await
            .unwrap();
    assert_eq!(
        after_lines, 1,
        "per-account opening journal posts once the window is closed"
    );
}
