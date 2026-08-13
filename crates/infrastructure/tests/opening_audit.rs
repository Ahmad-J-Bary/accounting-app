//! Phase 8 — opening-balance audit trail. Each lifecycle transition stamps its
//! metadata on the migration row AND the journal in the same transaction, so a
//! company's setup can be audited after the fact: who validated, who approved,
//! when it was posted, when it was locked.
//!
//! Covered here (through the real use cases):
//!   - validated_by / validated_at on Validate;
//!   - approved_by / approved_at on Approve;
//!   - posted_at persisted with the single AccountOpeningBalance journal;
//!   - locked_at on Lock;
//!   - the audit fields are readable back from the repository (not just the
//!     in-memory DTO the use case returns).

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_item_repository::OpeningItemRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::OpeningLineInput;
use application::use_cases::opening_balance::{
    ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase, LockOpeningBalanceUseCase,
    PostOpeningBalanceUseCase, ValidateOpeningBalanceUseCase,
};
use domain::accounting::opening_balance::OpeningBalanceMigration;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteJournalEntryRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository, SqliteOpeningPostingRepository,
    SqliteSettingsRepository,
};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_opening_audit_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn create_draft(pool: &Arc<sqlx::SqlitePool>) -> String {
    let cash = account_id_by_code(pool, "122").await;
    let equity = account_id_by_code(pool, "52").await;
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let draft = CreateOpeningBalanceUseCase::new(migration_repo, account_repo, settings_repo)
        .execute(application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
            cutover_date: chrono::Utc::now().to_rfc3339(),
            notes: None,
            source_system: None,
            source_reference: None,
            lines: vec![
                OpeningLineInput { account_id: cash.to_string(), amount: "2000".into(), description: None },
                OpeningLineInput { account_id: equity.to_string(), amount: "2000".into(), description: None },
            ],
        })
        .await
        .expect("create draft");
    draft.0.id
}

/// Reloads the migration from the repository (the persisted row, not the DTO).
async fn reload(pool: &Arc<sqlx::SqlitePool>, id: &str) -> OpeningBalanceMigration {
    let repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    repo.find_by_id(id).await.unwrap().expect("migration exists")
}

// ---------------------------------------------------------------------------
// Every transition stamps its audit metadata on the persisted row; the caller
// of each step is recorded, and timestamps exist only after their step.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn lifecycle_stamps_full_audit_trail_on_persisted_row() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let id = create_draft(&pool).await;

    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let item_repo: Arc<dyn OpeningItemRepository> =
        Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    // Draft: no audit metadata yet.
    let draft = reload(&pool, &id).await;
    assert!(draft.validated_at.is_none());
    assert!(draft.approved_at.is_none());
    assert!(draft.posted_at.is_none());
    assert!(draft.locked_at.is_none());

    // Validate by "validator-a".
    ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(id.clone(), "validator-a".into())
    .await
    .expect("validate");
    let validated = reload(&pool, &id).await;
    assert_eq!(validated.validated_by.as_deref(), Some("validator-a"));
    assert!(validated.validated_at.is_some());
    assert!(validated.approved_at.is_none(), "approve metadata appears only after approve");

    // Approve by "approver-b".
    ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(id.clone(), "approver-b".into())
        .await
        .expect("approve");
    let approved = reload(&pool, &id).await;
    assert_eq!(approved.approved_by.as_deref(), Some("approver-b"));
    assert!(approved.approved_at.is_some());

    // Post: posted_at stamped on the row, alongside the single opening journal.
    PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(id.clone())
    .await
    .expect("post");
    let posted = reload(&pool, &id).await;
    assert!(posted.posted_at.is_some());
    assert!(posted.locked_at.is_none());

    let opening_journal_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id = ?",
    )
    .bind(format!("opening_balance:{id}"))
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(opening_journal_count, 1, "the audit trail has exactly one opening journal");

    // Lock: locked_at stamped.
    LockOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(id.clone())
    .await
    .expect("lock");
    let locked = reload(&pool, &id).await;
    assert!(locked.locked_at.is_some());
    assert!(locked.validated_at.is_some(), "validated_at survives the whole lifecycle");
    assert!(locked.approved_at.is_some(), "approved_at survives the whole lifecycle");
    assert!(locked.posted_at.is_some(), "posted_at survives the whole lifecycle");
    assert_eq!(locked.validated_by.as_deref(), Some("validator-a"));
    assert_eq!(locked.approved_by.as_deref(), Some("approver-b"));
}
