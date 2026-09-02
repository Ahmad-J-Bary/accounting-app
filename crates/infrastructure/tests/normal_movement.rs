//! Normal Movement: the everyday business path exercised through the
//! unified invoice module against a real database.
//!
//! Covered here:
//!   - a credit (deferred) sale to a REGISTERED customer: the stock movement
//!     (Sale) is created, the CreditSalesJournal is balanced, and the customer's
//!     linked AR account (the sub-ledger) carries exactly the invoice total —
//!     reconciling the sub-ledger to the general ledger;
//!   - the whole ledger stays balanced (Dr AR / Cr Revenue, and the cash
//!     receipt for the paid portion is its own balanced journal).

use std::str::FromStr;
use std::sync::Arc;

use application::dto::customer_dto::CreateCustomerRequest;
use application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceLineDto};
use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::material_repository::MaterialRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::customer::CreateCustomerUseCase;
use application::use_cases::unified_invoice::{
    CreateInvoiceUseCase, PostInvoiceDependencies, PostInvoiceUseCase,
};
use domain::inventory::material::Material;
use domain::shared::AccountId;
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
        "acc_normal_movement_{}.sqlite",
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
        "مادة".into(),
        "M-NORMAL".into(),
        "M-NORMAL".into(),
        Decimal::ZERO,
        vec![("قطعة".into(), Decimal::ONE, None)],
        vec![],
    )
    .unwrap();
    let material_repo = SqliteMaterialRepository::new(pool.clone());
    material_repo.save(&material).await.unwrap();
    material
}

fn invoice_deps(pool: &Arc<sqlx::SqlitePool>) -> PostInvoiceDependencies {
    PostInvoiceDependencies {
        repo: Arc::new(SqliteUnifiedInvoiceRepository::new(pool.clone())),
        movement_repo: Arc::new(SqliteStockMovementRepository::new(pool.clone())),
        lot_repo: Arc::new(SqliteInventoryLotRepository::new(pool.clone())),
        journal_repo: Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        account_repo: Arc::new(SqliteAccountRepository::new(pool.clone())),
        customer_repo: Arc::new(SqliteCustomerRepository::new(pool.clone())),
        supplier_repo: Arc::new(SqliteSupplierRepository::new(pool.clone())),
        material_repo: Arc::new(SqliteMaterialRepository::new(pool.clone())),
        category_repo: Arc::new(SqliteCategoryRepository::new(pool.clone())),
        currency_repo: Arc::new(SqliteCurrencyRepository::new(pool.clone())),
        exchange_rate_repo: Arc::new(SqliteExchangeRateRepository::new(pool.clone())),
        opening_migration_repo: Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
    }
}

fn make_line(material: &Material, quantity: &str, unit_price: &str) -> InvoiceLineDto {
    InvoiceLineDto {
        id: String::new(),
        material_id: material.id.to_string(),
        material_name: Some(material.name.clone()),
        barcode: None,
        code: None,
        category_name: None,
        quantity: quantity.into(),
        unit_id: None,
        conversion_factor: None,
        unit_price: unit_price.into(),
        unit_price_v2: None,
        purchase_price: Some(unit_price.into()),
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
    }
}

struct InvoiceSpec<'a> {
    invoice_type: &'a str,
    customer_id: Option<String>,
    payment_method: &'a str,
    amount_paid: &'a str,
    material: &'a Material,
    quantity: &'a str,
    unit_price: &'a str,
}

async fn post_invoice(pool: &Arc<sqlx::SqlitePool>, spec: InvoiceSpec<'_>) -> String {
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
        invoice_type: spec.invoice_type.into(),
        customer_id: spec.customer_id,
        customer_name: None,
        supplier_id: None,
        supplier_name: None,
        lines: vec![make_line(spec.material, spec.quantity, spec.unit_price)],
        tax_amount: "0".into(),
        discount_amount: "0".into(),
        extra_costs: None,
        payment_method: spec.payment_method.into(),
        amount_paid: spec.amount_paid.into(),
        issued_at: chrono::Utc::now().to_rfc3339(),
        currency_code: "S".into(),
        exchange_rate: "1".into(),
        notes: None,
    })
    .await
    .expect("create invoice");

    let invoice_id = invoice.id.clone();
    PostInvoiceUseCase::new(invoice_deps(pool))
        .execute(invoice.id)
        .await
        .expect("post invoice");
    invoice_id
}

// ---------------------------------------------------------------------------
// Credit sale to a REGISTERED customer: one Sale stock movement, a balanced
// CreditSalesJournal, and the customer AR sub-ledger reconciling to the GL.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn credit_sale_to_registered_customer_reconciles_ar_subledger() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    // Registered customer (no opening balance → no partner opening journal).
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let customer = CreateCustomerUseCase::new(
        Arc::new(SqliteCustomerRepository::new(pool.clone())),
        account_repo.clone(),
        journal_repo.clone(),
        migration_repo.clone(),
    )
    .execute(CreateCustomerRequest {
        code: "".into(),
        name: "عميل آجل".into(),
        phone: None,
        address: None,
        account_id: None,
        debit: None,
        credit: None,
        opening_balance: None,
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
        notes: None,
    })
    .await
    .expect("create customer");
    let ar_account = AccountId(uuid::Uuid::parse_str(&customer.account_id.unwrap()).unwrap());

    // Stock the material (OpeningBalance invoice), then a Deferred credit sale
    // of 5 @ 80 = 400 to the registered customer.
    let material = create_material(&pool).await;
    post_invoice(
        &pool,
        InvoiceSpec {
            invoice_type: "OpeningBalance",
            customer_id: None,
            payment_method: "Deferred",
            amount_paid: "0",
            material: &material,
            quantity: "10",
            unit_price: "50",
        },
    )
    .await;
    post_invoice(
        &pool,
        InvoiceSpec {
            invoice_type: "Sales",
            customer_id: Some(customer.id.clone()),
            payment_method: "Deferred",
            amount_paid: "0",
            material: &material,
            quantity: "5",
            unit_price: "80",
        },
    )
    .await;

    // Exactly one Sale stock movement for the credit sale.
    let sale_movements: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM stock_movements WHERE movement_type = 'Sale'")
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(
        sale_movements, 1,
        "the credit sale created exactly one Sale movement"
    );

    // The CreditSalesJournal is balanced and its total is the invoice total (400).
    let (d, c): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL)),0), COALESCE(SUM(CAST(jl.credit_base AS REAL)),0)
         FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.journal_type = 'CreditSalesJournal'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(
        close_enough(d, c),
        "CreditSalesJournal must balance ({d} vs {c})"
    );
    assert!(
        close_enough(d, 400.0),
        "CreditSalesJournal total is 400, got {d}"
    );

    // The customer AR sub-ledger carries exactly the receivable → reconciles to GL.
    assert!(
        close_enough(ledger_balance(&pool, &ar_account).await, 400.0),
        "customer AR sub-ledger must carry the 400 receivable"
    );

    // The AR leg of the sale is credited to Revenue (CreditSales 312).
    // Check the sale journal touches the AR account and the 312 revenue account.
    let touched: Vec<String> = sqlx::query_scalar(
        "SELECT jl.account_id FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.journal_type = 'CreditSalesJournal'",
    )
    .fetch_all(&*pool)
    .await
    .unwrap();
    assert!(
        touched.contains(&ar_account.0.to_string()),
        "CreditSalesJournal must debit the AR account"
    );
    let revenue = sqlx::query_scalar::<_, String>("SELECT id FROM accounts WHERE code = '312'")
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert!(
        touched.contains(&revenue),
        "CreditSalesJournal must credit the deferred-sales revenue account"
    );

    // The whole ledger stays balanced (opening stock + sale).
    let (td, tc): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL)),0), COALESCE(SUM(CAST(credit_base AS REAL)),0)
         FROM journal_lines",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(
        close_enough(td, tc),
        "whole ledger must balance ({td} vs {tc})"
    );
}
