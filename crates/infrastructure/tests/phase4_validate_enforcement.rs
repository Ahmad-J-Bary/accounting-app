//! Phase 4 — structural validation is enforced BEFORE a migration is marked
//! validated (Draft → Validated).
//!
//! Previously `ValidateOpeningBalanceUseCase` only flipped the domain state;
//! the accounting-equation and sub-ledger gates were deferred to Post/Lock.
//! Phase 4 makes Validate run the same `readiness_blockers` checks as Posting:
//! the opening lines must be in equilibrium (Debit = Credit) AND each entered
//! sub-ledger detail (AR/AP/Inventory/FA) must reconcile to the general-ledger
//! opening lines. A migration that fails either gate stays in Draft.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::customer_repository::CustomerRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningItemInput, OpeningLineInput, SaveOpeningItemsCommand,
};
use application::use_cases::opening_balance::{
    CreateOpeningBalanceUseCase, KIND_AR, SaveOpeningItemsUseCase, ValidateOpeningBalanceUseCase,
};
use domain::accounting::MigrationStatus;
use domain::customers::Customer;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteCustomerRepository,
    SqliteJournalEntryRepository, SqliteOpeningItemRepository, SqliteOpeningMigrationRepository,
    SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_phase4_validate_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Builds an `CreateOpeningBalanceUseCase` over the pool.
fn create_migration(pool: &Arc<sqlx::SqlitePool>) -> CreateOpeningBalanceUseCase {
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    CreateOpeningBalanceUseCase::new(migration_repo, account_repo, settings_repo)
}

fn to_lines(lines: Vec<(AccountId, &str)>) -> Vec<OpeningLineInput> {
    lines
        .into_iter()
        .map(|(account_id, amount)| OpeningLineInput {
            account_id: account_id.to_string(),
            amount: amount.into(),
            description: None,
        })
        .collect()
}

fn validator(pool: &Arc<sqlx::SqlitePool>) -> ValidateOpeningBalanceUseCase {
    ValidateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteOpeningItemRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
    )
}

async fn migration_status(pool: &Arc<sqlx::SqlitePool>, id: &str) -> MigrationStatus {
    let repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    repo.find_by_id(id).await.unwrap().unwrap().status
}

// ---------------------------------------------------------------------------
// Rejected: opening lines out of equilibrium (Debit ≠ Credit) → cannot validate.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn validate_rejects_draft_whose_debit_credit_are_unequal() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let cash = account_id_by_code(&pool, "122").await;
    let equity = account_id_by_code(&pool, "52").await;
    let create = create_migration(&pool);
    let draft = create
        .execute(CreateOpeningBalanceMigrationCommand {
            cutover_date: chrono::Utc::now().to_rfc3339(),
            notes: None,
            source_system: None,
            source_reference: None,
            lines: to_lines(vec![(cash, "1000"), (equity, "500")]),
        })
        .await
        .expect("create unbalanced draft");

    let err = validator(&pool).execute(draft.0.id.clone(), "system".into()).await;
    assert!(err.is_err(), "unbalanced draft must be rejected at validation");
    assert_eq!(
        migration_status(&pool, &draft.0.id).await,
        MigrationStatus::Draft,
        "rejected validation must leave the migration in Draft"
    );
}

// ---------------------------------------------------------------------------
// Rejected: a sub-ledger detail (AR) does not reconcile to the GL — the AR item
// totals 700 while the general ledger carries no matching Receivable line.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn validate_rejects_draft_whose_subledger_does_not_reconcile() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    // G/L side: balanced but without any Receivable line (1000 asset / 1000 equity).
    let cash = account_id_by_code(&pool, "122").await;
    let equity = account_id_by_code(&pool, "52").await;
    let create = create_migration(&pool);
    let draft = create
        .execute(CreateOpeningBalanceMigrationCommand {
            cutover_date: chrono::Utc::now().to_rfc3339(),
            notes: None,
            source_system: None,
            source_reference: None,
            lines: to_lines(vec![(cash, "1000"), (equity, "1000")]),
        })
        .await
        .expect("create balanced draft without AR GL line");

    // Sub-ledger side: a real customer carrying a 700 opening AR balance.
    let customer = Customer::new(
        "C-P4".into(),
        "عميل أول المدة".into(),
        None,
        None,
        None,
        Decimal::ZERO,
        Decimal::ZERO,
        Decimal::from(700),
        domain::shared::Currency::new("S", "عملة أساسية", "Base", "B", 2, true),
        None,
    )
    .unwrap();
    SqliteCustomerRepository::new(pool.clone())
        .save(&customer)
        .await
        .unwrap();

    let item_repo = Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let customer_repo: Arc<dyn CustomerRepository> =
        Arc::new(SqliteCustomerRepository::new(pool.clone()));
    let supplier_repo = Arc::new(infrastructure::repositories::SqliteSupplierRepository::new(pool.clone()));
    let material_repo = Arc::new(infrastructure::repositories::SqliteMaterialRepository::new(pool.clone()));
    let asset_repo = Arc::new(infrastructure::repositories::SqliteAssetRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));

    SaveOpeningItemsUseCase::new(
        migration_repo,
        item_repo,
        customer_repo,
        supplier_repo,
        material_repo,
        asset_repo,
    )
    .execute(SaveOpeningItemsCommand {
        migration_id: draft.0.id.clone(),
        items: vec![OpeningItemInput {
            kind: KIND_AR.to_string(),
            entity_id: customer.id.to_string(),
            reference: None,
            amount: "700".into(),
            qty: "0".into(),
        }],
    })
    .await
    .expect("save AR sub-ledger item");

    let err = validator(&pool).execute(draft.0.id.clone(), "system".into()).await;
    assert!(err.is_err(), "non-reconciled sub-ledger must block validation");
    assert_eq!(
        migration_status(&pool, &draft.0.id).await,
        MigrationStatus::Draft,
        "rejected validation must leave the migration in Draft"
    );
}

// ---------------------------------------------------------------------------
// Accepted: balanced opening lines with no sub-ledger detail → validates.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn validate_accepts_balanced_reconciled_draft() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let cash = account_id_by_code(&pool, "122").await;
    let equity = account_id_by_code(&pool, "52").await;
    let create = create_migration(&pool);
    let draft = create
        .execute(CreateOpeningBalanceMigrationCommand {
            cutover_date: chrono::Utc::now().to_rfc3339(),
            notes: None,
            source_system: None,
            source_reference: None,
            lines: to_lines(vec![(cash, "1000"), (equity, "1000")]),
        })
        .await
        .expect("create balanced draft");

    let validated = validator(&pool)
        .execute(draft.0.id.clone(), "system".into())
        .await
        .expect("balanced reconciled draft must validate");
    assert_eq!(validated.0.status, MigrationStatus::Validated);
    assert_eq!(validated.0.validated_by.as_deref(), Some("system"));
}