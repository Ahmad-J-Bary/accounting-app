//! Phase 8 — critical path for an EXISTING company (Company Setup → Normal
//! operation), exercised through the real application use cases against a real
//! SQLite database.
//!
//! The full lifecycle under test:
//!   ExistingCompany start mode
//!     → CreateOpeningBalanceUseCase        (Draft)
//!     → ValidateOpeningBalanceUseCase      (Validated)
//!     → ApproveOpeningBalanceUseCase       (Approved)
//!     → PostOpeningBalanceUseCase          (Posted, journal persisted)
//!     → LockOpeningBalanceUseCase          (Locked, window closed)
//!     → CreatePartnerUseCase + contribution (real cash event, exactly like a
//!       new company — the closed window is the ONLY lifecycle difference).
//!
//! Assertions are live-ledger based (journal_lines are the source of truth),
//! not re-implementations of domain logic.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::account_repository::AccountRepository;
use application::ports::currency_repository::CurrencyRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::partner_repository::PartnerRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::OpeningLineInput;
use application::use_cases::opening_balance::{
    ApproveOpeningBalanceUseCase, CreateOpeningBalanceUseCase, LockOpeningBalanceUseCase,
    PostOpeningBalanceUseCase, ValidateOpeningBalanceUseCase,
};
use application::use_cases::partner::{CreateCapitalContributionUseCase, CreatePartnerUseCase};
use domain::accounting::MigrationStatus;
use domain::shared::ids::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteCurrencyRepository, SqliteJournalEntryRepository,
    SqliteOpeningItemRepository, SqliteOpeningMigrationRepository,
    SqliteOpeningPostingRepository, SqlitePartnerRepository, SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_critical_existing_{}.sqlite", uuid::Uuid::new_v4()));
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

/// Sum of posted journal lines touching an account (base units). Positive = net
/// debit increase; credit-normal accounts yield a negative value for credits.
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

/// Runs the entire opening-balance lifecycle through the real use cases and
/// returns the migration id. The caller keeps the `pool` alive.
async fn run_opening_lifecycle(pool: &Arc<sqlx::SqlitePool>) -> String {
    let cash = account_id_by_code(pool, "122").await;
    let equity = account_id_by_code(pool, "52").await;

    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let item_repo = Arc::new(SqliteOpeningItemRepository::new(pool.clone()));
    let posting_repo = Arc::new(SqliteOpeningPostingRepository::new(pool.clone()));

    // 1) Draft
    let draft = CreateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        account_repo.clone(),
        settings_repo.clone(),
    )
    .execute(application::use_cases::opening_balance::types::CreateOpeningBalanceMigrationCommand {
        cutover_date: chrono::Utc::now().to_rfc3339(),
        notes: None,
        source_system: Some("Legacy".into()),
        source_reference: Some("EXISTING-2025".into()),
        lines: vec![
            OpeningLineInput { account_id: cash.to_string(), amount: "5000".into(), description: None },
            OpeningLineInput { account_id: equity.to_string(), amount: "5000".into(), description: None },
        ],
    })
    .await
    .expect("create draft migration");
    let id = draft.0.id.clone();
    assert_eq!(draft.0.status, MigrationStatus::Draft);
    assert_eq!(draft.0.source_system.as_deref(), Some("Legacy"), "source provenance must persist");

    // 2) Validated
    let validated = ValidateOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(id.clone(), "tester".into())
    .await
    .expect("balanced reconciled draft must validate");
    assert_eq!(validated.0.status, MigrationStatus::Validated);

    // 3) Approved
    let approved = ApproveOpeningBalanceUseCase::new(migration_repo.clone())
        .execute(id.clone(), "approver".into())
        .await
        .expect("validated migration must approve");
    assert_eq!(approved.0.status, MigrationStatus::Approved);
    assert_eq!(approved.0.approved_by.as_deref(), Some("approver"));

    // 4) Posted — the aggregate opening journal enters the ledger.
    let posted = PostOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        posting_repo.clone(),
    )
    .execute(id.clone())
    .await
    .expect("approved reconciled migration must post");
    assert_eq!(posted.migration.0.status, MigrationStatus::Posted);
    assert_eq!(posted.debit_total, posted.credit_total, "posting journal must balance");

    // 5) Locked — the window closes.
    let locked = LockOpeningBalanceUseCase::new(
        migration_repo.clone(),
        item_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
    )
    .execute(id.clone())
    .await
    .expect("posted migration with zero control must lock");
    assert_eq!(locked.0.status, MigrationStatus::Locked);

    id
}

// ---------------------------------------------------------------------------
// The full Existing-company critical chain reaches Locked with a balanced,
// persisted opening journal and a closed window.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn existing_company_full_lifecycle_reaches_locked_and_persists_journal() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;

    let cash = account_id_by_code(&pool, "122").await;
    let equity = account_id_by_code(&pool, "52").await;
    let migration_id = run_opening_lifecycle(&pool).await;

    // The opening journal is persisted exactly once, sourced to the migration.
    let opening_journals: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id = ?",
    )
    .bind(format!("opening_balance:{migration_id}"))
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(opening_journals, 1, "exactly one opening journal, sourced to the migration");

    // Live ledger reflects the opening: cash +5000, equity −5000 (credit).
    assert!(close_enough(ledger_balance(&pool, &cash).await, 5000.0), "cash ledger must carry the opening");
    assert!(close_enough(ledger_balance(&pool, &equity).await, -5000.0), "equity ledger must carry the opening (credit)");

    // No second opening journal was posted by any other path (R1: no double count).
    let opening_type_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'AccountOpeningBalance'",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(opening_type_count, 1, "no duplicate AccountOpeningBalance journal");

    // The migration row is Locked in the DB (persisted, not just in-memory).
    let status: String = sqlx::query_scalar(
        "SELECT status FROM opening_balance_migrations WHERE id = ?",
    )
    .bind(&migration_id)
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(status, "Locked");
}

// ---------------------------------------------------------------------------
// After the window closes, an Existing company behaves EXACTLY like a new one:
// a real cash capital contribution increases cash AND the partner's capital
// ledger (the guard that blocks it during the window is gone).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn after_lock_company_behaves_like_new_for_capital_contribution() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    run_opening_lifecycle(&pool).await;

    let cash = account_id_by_code(&pool, "122").await;

    // Register a partner exactly as the app would (no journal on creation).
    let partner_repo: Arc<dyn PartnerRepository> =
        Arc::new(SqlitePartnerRepository::new(pool.clone()));
    let account_repo: Arc<dyn AccountRepository> =
        Arc::new(SqliteAccountRepository::new(pool.clone()));
    let currency_repo: Arc<dyn CurrencyRepository> =
        Arc::new(SqliteCurrencyRepository::new(pool.clone()));
    let partner_id = CreatePartnerUseCase::new(partner_repo.clone(), account_repo.clone(), currency_repo)
        .execute(
            "شريك بعد الإغلاق".into(),
            "S".into(),
            Decimal::ONE,
            Decimal::ZERO,
            false,
            "BasedOnCapitalLocal".into(),
            None,
            START_MODE_EXISTING.into(),
        )
        .await
        .expect("create partner");

    let cap_id: AccountId = {
        let partner = partner_repo
            .find_by_id(&domain::shared::ids::PartnerId::from_str(&partner_id).unwrap())
            .await
            .unwrap()
            .expect("partner exists");
        partner.linked_account_id.expect("partner has capital account")
    };

    // The window is closed (Locked), so a cash contribution is a REAL event.
    let journal_repo: Arc<dyn JournalEntryRepository> =
        Arc::new(SqliteJournalEntryRepository::new(pool.clone()));
    let migration_repo: Arc<dyn OpeningMigrationRepository> =
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()));
    CreateCapitalContributionUseCase::new(
        partner_repo,
        account_repo,
        journal_repo,
        migration_repo,
    )
    .execute(partner_id, cash.to_string(), Decimal::from(750), false, Some("post-lock-1".into()))
    .await
    .expect("contribution must be accepted after the window closes");

    // Ledger is the truth: cash +750 and capital credit −750 on top of opening.
    assert!(close_enough(ledger_balance(&pool, &cash).await, 5750.0), "cash must increase by 750 after lock");
    assert!(close_enough(ledger_balance(&pool, &cap_id).await, -750.0), "capital ledger must increase by 750 (credit)");
}
