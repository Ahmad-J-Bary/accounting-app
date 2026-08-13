//! Phase 8 — Fixed Asset through the REAL use cases and repository. Creating an
//! asset posts a balanced acquisition journal (Dr asset / Cr payment account)
//! with its AssetMovement; posting depreciation writes a balanced expense /
//! accumulated-depreciation journal; and the Asset Ledger reconciles:
//! `purchase_cost = accumulated_depreciation + net_book_value` (the sub-ledger
//! balances against the general ledger).
//!
//! Under test:
//!   - create_asset → one acquisition journal + one AssetMovement;
//!   - post_depreciation → one depreciation journal + one movement;
//!   - every journal balances and the whole ledger stays balanced;
//!   - asset ledger reconcile: accumulated + net book = original cost.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::asset_repository::AssetRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::account::types::CreateAccountCommand;
use application::use_cases::account::CreateAccountUseCase;
use application::use_cases::asset::fixed_asset::{CreateAssetRequest, FixedAssetUseCases};
use chrono::Utc;
use domain::accounting::account::{AccountCategory, AccountType};
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use domain::shared::money::Money;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteAssetRepository, SqliteCurrencyRepository,
    SqliteJournalEntryRepository, SqliteOpeningMigrationRepository, SqliteSettingsRepository,
};
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_fixed_asset_{}.sqlite", uuid::Uuid::new_v4()));
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
    let base = Currency::new("S", "عملة أساسية", "Base", "B", 2, true);
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

async fn create_leaf_account(
    pool: &Arc<sqlx::SqlitePool>,
    code: &str,
    name_ar: &str,
    account_type: AccountType,
    parent_id: AccountId,
) -> AccountId {
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account = CreateAccountUseCase::new(
        account_repo,
        journal_repo,
        None,
        None,
        currency_repo,
        migration_repo,
    )
    .execute(CreateAccountCommand {
        code: code.into(),
        name_ar: name_ar.into(),
        name_en: name_ar.into(),
        account_type,
        parent_id: Some(parent_id),
        category: AccountCategory::Detail,
        level: 3,
        opening_balance: "0".into(),
        notes: None,
        linked_customer_id: None,
        linked_supplier_id: None,
        phone: None,
        address: None,
        debit: Some("0".into()),
        credit: None,
        currency: Some("S".into()),
        exchange_rate: Some("1".into()),
    })
    .await
    .expect("create account");
    account.id
}

// ---------------------------------------------------------------------------
// Creating an asset (Dr asset / Cr cash) and posting one month of depreciation
// keeps every journal balanced and the asset sub-ledger reconciled with the GL:
// purchase cost = accumulated depreciation + net book value.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn fixed_asset_acquisition_and_depreciation_reconcile_asset_ledger() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let asset_account = account_id_by_code(&pool, "111").await; // Buildings & Land (11 prefix, post-015)
    let cash = account_id_by_code(&pool, "122").await;
    let fixed_assets_root = account_id_by_code(&pool, "11").await;
    let other_expenses_root = account_id_by_code(&pool, "43").await;

    // Depreciation-expense (under 43) and accumulated-depreciation (under 11)
    // leaf accounts created through the real module.
    let dep_expense = create_leaf_account(&pool, "4391", "مصروف إهلاك الأصول", AccountType::Expenses, other_expenses_root).await;
    let acc_dep = create_leaf_account(&pool, "1199", "مجمع إهلاك الأصول", AccountType::Assets, fixed_assets_root).await;

    let asset_repo: Arc<dyn AssetRepository> = Arc::new(SqliteAssetRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let uc = FixedAssetUseCases::new(asset_repo.clone(), journal_repo.clone(), account_repo.clone());

    // The asset category must exist before the asset (FK on asset_categories).
    let category = domain::assets::AssetCategory::new(
        "أصول ثابتة".into(),
        domain::assets::AssetType::Fixed,
    );
    asset_repo.save_category(&category).await.expect("save category");

    // Acquire a 12000 asset with 12-month straight-line life → 1000/month.
    let purchase_date = Utc::now();
    let cost = Money::new(dec!(12000), Currency::new("S", "عملة أساسية", "Base", "B", 2, true));
    let asset_id = uc
        .create_asset(CreateAssetRequest {
            code: "FA-100".into(),
            name: "مبنى المخزن".into(),
            category_id: category.id,
            warehouse_id: None,
            purchase_date,
            purchase_cost: cost.clone(),
            fx_rate: dec!(1),
            useful_life_months: 12,
            asset_account_id: asset_account.0,
            depreciation_account_id: dep_expense.0,
            accumulated_depreciation_account_id: acc_dep.0,
            payment_account_id: cash.0,
            addition_type: "new".into(),
            notes: None,
            location: None,
            salvage_value: None,
            depreciation_method: None,
        })
        .await
        .expect("create asset");

    // Acquisition journal: Dr asset 12000 / Cr cash 12000, balanced.
    assert!(close_enough(ledger_balance(&pool, &asset_account).await, 12000.0), "asset account +12000");
    assert!(close_enough(ledger_balance(&pool, &cash).await, -12000.0), "cash −12000");

    // Exactly one acquisition movement on the real asset.
    let movements: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM asset_movements WHERE asset_id = ?")
            .bind(asset_id.0.to_string())
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(movements, 1, "exactly one acquisition movement");

    // Post one month of depreciation → 1000.
    uc.post_depreciation(asset_id.0, Utc::now()).await.expect("post depreciation");

    // Depreciation journal: Dr depreciation expense 1000 / Cr acc. dep 1000.
    assert!(close_enough(ledger_balance(&pool, &dep_expense).await, 1000.0), "depreciation expense +1000");
    assert!(close_enough(ledger_balance(&pool, &acc_dep).await, -1000.0), "accumulated depreciation −1000 (credit)");

    // Asset sub-ledger reconcile: cost = accumulated + net book value.
    let asset = asset_repo.find_asset_by_id(&asset_id).await.unwrap().expect("asset exists");
    let acc_dep_amount = asset.accumulated_depreciation.amount();
    let net_book = asset.net_book_value().amount();
    assert_eq!(acc_dep_amount + net_book, dec!(12000), "asset ledger: accumulated + NBV = cost");

    // Exactly one acquisition + one depreciation movement.
    let movements: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM asset_movements WHERE asset_id = ?")
            .bind(asset_id.0.to_string())
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(movements, 2, "acquisition + depreciation movements");

    // Every journal balances and the whole ledger stays balanced.
    let unbalanced: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (
            SELECT je.id
            FROM journal_entries je
            JOIN journal_lines jl ON jl.journal_entry_id = je.id
            GROUP BY je.id
            HAVING ABS(SUM(CAST(jl.debit_base AS REAL)) - SUM(CAST(jl.credit_base AS REAL))) > 0.01
        )",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(unbalanced, 0, "all asset journals must balance");

    let (td, tc): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL)),0), COALESCE(SUM(CAST(credit_base AS REAL)),0)
         FROM journal_lines",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(close_enough(td, tc), "whole ledger must balance (debit {td} vs credit {tc})");
}