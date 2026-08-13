//! Phase 8 — Opening-balance Cancel through the REAL use cases. After a
//! migration is posted, CancelOpeningBalanceUseCase must reverse it with a true
//! contra journal (source `ob_reversal:{id}`) and mark the migration Cancelled,
//! leaving every account back at its pre-opening net and the ledger balanced.
//! Cancelling a Draft before posting simply moves it to Cancelled without any
//! journal, and the whole flow stays idempotent.
//!
//! Covered here:
//!   - create -> validate -> approve -> post -> cancel;
//!   - the reversal journal swaps debit/credit so each account nets back to 0;
//!   - exactly one `OpeningBalanceReversal` journal, source `ob_reversal:{id}`;
//!   - the migration row is persisted as Cancelled;
//!   - the whole ledger stays balanced after cancel.

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
    ApproveOpeningBalanceUseCase, CancelOpeningBalanceUseCase, CreateOpeningBalanceUseCase,
    PostOpeningBalanceUseCase, ValidateOpeningBalanceUseCase,
};
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
    path.push(format!("acc_opening_cancel_{}.sqlite", uuid::Uuid::new_v4()));
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
    let draft = CreateOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
    )
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

async fn post_migration(pool: &Arc<sqlx::SqlitePool>, id: &str) {
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

    ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(id.to_string(), "validator".into())
    .await
    .expect("validate");

    ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(id.to_string(), "approver".into())
        .await
        .expect("approve");

    PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(id.to_string())
    .await
    .expect("post");
}

// ---------------------------------------------------------------------------
// Full lifecycle through the use cases; cancellation reverses the posted
// journal so every account nets back to zero and the migration is Cancelled.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn posted_opening_is_cancelled_with_balanced_reversal() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let id = create_draft(&pool).await;
    post_migration(&pool, &id).await;

    let cash = account_id_by_code(&pool, "122").await;
    let equity = account_id_by_code(&pool, "52").await;

    // Posting created the opening journal: cash +2000 (debit), equity −2000.
    assert_eq!(
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM journal_entries WHERE source_id = ?",
        )
        .bind(format!("opening_balance:{id}"))
        .fetch_one(&*pool)
        .await
        .unwrap(),
        1
    );

    // Cancel via the use case.
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let posting_repo: Arc<dyn OpeningPostingRepository> =
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));
    let cancelled = CancelOpeningBalanceUseCase::new(migration_repo.clone(), journal_repo.clone(), posting_repo.clone())
        .execute(id.clone())
        .await
        .expect("cancel");

    assert_eq!(cancelled.0.status, domain::accounting::MigrationStatus::Cancelled);

    // Persisted row is Cancelled.
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT status FROM opening_balance_migrations WHERE id = ?")
            .bind(&id)
            .fetch_one(&*pool)
            .await
            .unwrap(),
        "Cancelled"
    );

    // Exactly one OpeningBalanceReversal journal with the canonical source id.
    let (count, source): (i64, Option<String>) = sqlx::query_as(
        "SELECT COUNT(*), MAX(source_id) FROM journal_entries WHERE journal_type = 'OpeningBalanceReversal'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(count, 1, "exactly one reversal journal");
    assert_eq!(source.as_deref(), Some(format!("ob_reversal:{id}").as_str()));

    // Each account nets back to zero (opening + reversal cancel out).
    let (d, c): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL)),0), COALESCE(SUM(CAST(credit_base AS REAL)),0)
         FROM journal_lines WHERE account_id IN (?, ?)",
    )
    .bind(cash.0.to_string())
    .bind(equity.0.to_string())
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(close_enough(d, c), "reversal swaps legs so cash+equity net balanced ({d} vs {c})");
    let cash_net: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL) - CAST(credit_base AS REAL)),0)
         FROM journal_lines WHERE account_id = ?",
    )
    .bind(cash.0.to_string())
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(close_enough(cash_net, 0.0), "cash nets back to zero after cancel, got {cash_net}");

    // Whole ledger still balanced.
    let (td, tc): (f64, f64) = sqlx::query_as(
        "SELECT COALESCE(SUM(CAST(debit_base AS REAL)),0), COALESCE(SUM(CAST(credit_base AS REAL)),0)
         FROM journal_lines",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert!(close_enough(td, tc), "whole ledger must balance after cancel ({td} vs {tc})");

    // Idempotent: cancelling again returns the same Cancelled state.
    let again = CancelOpeningBalanceUseCase::new(migration_repo, journal_repo, posting_repo)
        .execute(id)
        .await
        .expect("idempotent cancel");
    assert_eq!(again.0.status, domain::accounting::MigrationStatus::Cancelled);
    let reversal_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'OpeningBalanceReversal'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(reversal_count, 1, "a second cancel must not post another reversal");
}

// ---------------------------------------------------------------------------
// Cancelling a Draft (before posting) transitions it to Cancelled with no
// journal at all.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn cancel_draft_requires_no_journal() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let id = create_draft(&pool).await;

    let cancelled = CancelOpeningBalanceUseCase::new(
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
        Arc::new(SqliteJournalEntryRepository::new(pool.clone())),
        Arc::new(SqliteOpeningPostingRepository::new(pool.clone())),
    )
    .execute(id.clone())
    .await
    .expect("cancel draft");

    assert_eq!(cancelled.0.status, domain::accounting::MigrationStatus::Cancelled);
    let journal_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries").fetch_one(&*pool).await.unwrap();
    assert_eq!(journal_count, 0, "cancelling a draft posts no journal");
    assert_eq!(
        sqlx::query_scalar::<_, String>("SELECT status FROM opening_balance_migrations WHERE id = ?")
            .bind(&id)
            .fetch_one(&*pool)
            .await
            .unwrap(),
        "Cancelled"
    );
}

fn close_enough(actual: f64, expected: f64) -> bool {
    (actual - expected).abs() < 0.01
}