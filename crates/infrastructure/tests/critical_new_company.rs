//! Phase 8 — critical path for a NEW company (no opening migration), through
//! the real application use cases against a real SQLite database.
//!
//! Under test:
//!   - partner master-data registration posts NO journal; its capital is a
//!     static balance that a real contribution event increases;
//!   - a cash capital contribution is a REAL ledger event (Dr cash / Cr capital);
//!   - creating a customer/supplier with an opening balance posts the classic
//!     partner opening journal (window is closed for a new company);
//!   - a cash sales invoice (unified module) posts exactly one balanced journal
//!     and its stock movement — the normal movement path.
//!
//! Assertions are live-ledger based (journal_lines are the source of truth).

use std::str::FromStr;
use std::sync::Arc;

use application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceLineDto};
use application::dto::customer_dto::CreateCustomerRequest;
use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::customer::CreateCustomerUseCase;
use application::use_cases::partner::{CreateCapitalContributionUseCase, CreatePartnerUseCase};
use application::use_cases::unified_invoice::{
    CreateInvoiceUseCase, PostInvoiceDependencies, PostInvoiceUseCase,
};
use domain::inventory::material::Material;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCategoryRepository, SqliteCurrencyRepository,
    SqliteCustomerRepository, SqliteExchangeRateRepository, SqliteInventoryLotRepository,
    SqliteJournalEntryRepository, SqliteMaterialRepository, SqliteOpeningMigrationRepository,
    SqlitePartnerRepository, SqliteSettingsRepository, SqliteStockMovementRepository,
    SqliteSupplierRepository, SqliteUnifiedInvoiceRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_critical_new_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Net of posted journal lines touching an account (base units). Positive = net
/// debit increase; credit-normal accounts yield negative for credits.
async fn ledger_balance(pool: &sqlx::SqlitePool, account_id: &AccountId) -> f64 {
    sqlx::query_scalar::<_, f64>(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL) - CAST(credit_base AS REAL)), 0.0)
         FROM journal_lines WHERE account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap()
}

fn close_enough(actual: f64, expected: f64) -> bool {
    (actual - expected).abs() < 0.01
}

async fn create_material(pool: &Arc<sqlx::SqlitePool>) -> Material {
    let material = Material::new(
        "مادة جديدة".into(),
        "M-NEW".into(),
        "M-NEW".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    let material_repo = SqliteMaterialRepository::new(pool.clone());
    material_repo.save(&material).await.unwrap();
    material
}

/// Posts an OpeningBalance purchase for the material through the unified module
/// so it has available stock (lots) before a sale is attempted.
async fn stock_material(pool: &Arc<sqlx::SqlitePool>, material: &Material) {
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
    .expect("create opening stock invoice");

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
    })
    .execute(invoice.id)
    .await
    .expect("post opening stock invoice");
}

async fn register_partner(pool: &Arc<sqlx::SqlitePool>) -> (String, AccountId) {
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let id = CreatePartnerUseCase::new(partner_repo.clone(), account_repo.clone(), currency_repo)
        .execute(
            "شريك جديد".into(),
            "S".into(),
            Decimal::ONE,
            Decimal::from(1000),
            false,
            "BasedOnCapitalLocal".into(),
            None,
            "NewCompany".into(),
        )
        .await
        .expect("create partner");
    let partner = partner_repo
        .find_by_id(&domain::shared::ids::PartnerId::from_str(&id).unwrap())
        .await
        .unwrap()
        .expect("partner exists");
    (id, partner.linked_account_id.expect("partner has capital account"))
}

// ---------------------------------------------------------------------------
// New company: partner registration posts NO journal; only a real contribution
// is a ledger event. This is the same code path an Existing company takes after
// the window closes (verified in critical_existing_company.rs).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn new_company_partner_registration_is_not_a_ledger_event() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let (_, cap_id) = register_partner(&pool).await;

    let journal_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries").fetch_one(&*pool).await.unwrap();
    assert_eq!(journal_count, 0, "partner master-data registration must post no journal");
    assert!(
        close_enough(ledger_balance(&pool, &cap_id).await, 0.0),
        "no capital journal until a real contribution"
    );
}

// ---------------------------------------------------------------------------
// A cash capital contribution is a real event: it increases BOTH cash and the
// partner's capital ledger (Dr cash / Cr capital), and never double-posts the
// same event on re-submission (idempotency key).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn new_company_capital_contribution_posts_real_balanced_event() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let (partner_id, cap_id) = register_partner(&pool).await;
    let cash = account_id_by_code(&pool, "122").await;

    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let uc = CreateCapitalContributionUseCase::new(
        partner_repo,
        account_repo,
        journal_repo,
        migration_repo,
    );

    let first = uc
        .execute(partner_id.clone(), cash.to_string(), Decimal::from(1000), false, Some("evt-1".into()))
        .await
        .expect("contribution posts");
    let replay = uc
        .execute(partner_id, cash.to_string(), Decimal::from(1000), false, Some("evt-1".into()))
        .await
        .expect("replay resolves to same journal");
    assert_eq!(first, replay, "re-submitting the same event must not double-post");

    assert!(close_enough(ledger_balance(&pool, &cash).await, 1000.0), "cash +1000");
    assert!(close_enough(ledger_balance(&pool, &cap_id).await, -1000.0), "capital credit −1000");
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'CapitalContribution'")
            .fetch_one(&*pool)
            .await
            .unwrap(),
        1,
        "exactly one capital contribution journal"
    );
}

// ---------------------------------------------------------------------------
// New company, window closed: creating a customer with an opening balance posts
// the classic partner opening journal (Dr receivables / Cr OBE 53), and the
// same module works for suppliers (Dr OBE / Cr payables).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn new_company_customer_supplier_opening_balance_posts_their_journals() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    // Customer with 700 opening debit.
    let customer_repo = Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let customer = CreateCustomerUseCase::new(
        customer_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "".into(),
        name: "عميل جديد".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: Some("700".into()),
        credit: None,
        opening_balance: Some("700".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer");
    let customer_account = customer.account_id.expect("customer has linked account");
    let customer_account = AccountId(uuid::Uuid::parse_str(&customer_account).unwrap());

    // Supplier with 500 opening credit.
    let supplier_repo = Arc::new(SqliteSupplierRepository::new(pool.clone()));
    let supplier_dto = application::use_cases::supplier::CreateSupplierUseCase::new(
        supplier_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(application::dto::supplier_dto::CreateSupplierRequest {
        code: "".into(),
        name: "مورد جديد".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: None,
        credit: Some("500".into()),
        opening_balance: Some("500".into()),
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create supplier");
    let supplier_account = supplier_dto.account_id.expect("supplier has linked account");
    let supplier_account = AccountId(uuid::Uuid::parse_str(&supplier_account).unwrap());

    let obe = account_id_by_code(&pool, "53").await;

    assert!(close_enough(ledger_balance(&pool, &customer_account).await, 700.0), "AR +700");
    assert!(close_enough(ledger_balance(&pool, &supplier_account).await, -500.0), "AP −500");
    assert!(close_enough(ledger_balance(&pool, &obe).await, -200.0), "OBE nets 700−500 = −200 (credit)");

    let lines: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines").fetch_one(&*pool).await.unwrap();
    assert_eq!(lines, 4, "customer + supplier opening journals = 2 balanced entries (4 legs)");
}

// ---------------------------------------------------------------------------
// A cash sales invoice on a NEW company posts exactly one balanced journal plus
// its stock movement — the normal movement path.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn new_company_cash_sale_posts_one_balanced_journal_and_stock_movement() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let material = create_material(&pool).await;
    stock_material(&pool, &material).await;
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
        invoice_type: "Sales".into(),
        customer_id: None,
        customer_name: Some("زبون نقدي".into()),
        supplier_id: None,
        supplier_name: None,
        lines: vec![InvoiceLineDto {
            id: String::new(),
            material_id: material.id.to_string(),
            material_name: Some(material.name.clone()),
            barcode: None,
            code: None,
            category_name: None,
            quantity: "5".into(),
            unit_id: None,
            conversion_factor: None,
            unit_price: "80".into(),
            unit_price_v2: None,
            purchase_price: Some("40".into()),
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
        payment_method: "Cash".into(),
        amount_paid: "400".into(),
        issued_at: chrono::Utc::now().to_rfc3339(),
        currency_code: "S".into(),
        exchange_rate: "1".into(),
        notes: None,
    })
    .await
    .expect("create sales invoice");

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
    })
    .execute(invoice.id)
    .await
    .expect("post sales invoice");

    // The Sale produced exactly one Sale stock movement on the real material.
    let movements: Vec<(String, String)> = sqlx::query_as(
        "SELECT material_id, movement_type FROM stock_movements WHERE movement_type = 'Sale'",
    )
    .fetch_all(&*pool)
    .await
    .unwrap();
    assert_eq!(movements.len(), 1, "exactly one Sale stock movement");
    assert_eq!(movements[0].0, material.id.to_string());

    // Exactly one CashSales journal for the sale (opening stock is its own entry).
    let sale_journals: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'CashSalesJournal'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(sale_journals, 1, "exactly one CashSales journal");

    // The whole ledger (opening stock + sale) is balanced and the sale journal
    // itself balances to the invoice total.
    let (d, c): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL)),0), COALESCE(SUM(CAST(credit_base AS REAL)),0)
         FROM journal_lines",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(close_enough(d, c), "full ledger must balance (debit {d} vs credit {c})");

    let (sd, sc): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL)),0), COALESCE(SUM(CAST(jl.credit_base AS REAL)),0)
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.journal_type = 'CashSalesJournal'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(close_enough(sd, sc), "sale journal must balance (debit {sd} vs credit {sc})");
    assert!(close_enough(sd, 400.0), "sale journal total is the invoice total (400), got {sd}");
}
