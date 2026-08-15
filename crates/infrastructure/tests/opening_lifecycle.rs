//! Phase 5 — opening lifecycle & feature gating (backend).
//!
//! The opening-balance workflow is a lifecycle, not a permanent mode: writable
//! only while an EXISTING company is still before OPENING_LOCKED. NEW companies
//! never touch it; once a migration is Locked it becomes read-only history — no
//! new writes, no new migrations, and (critically) NO data deletion: opening
//! journal entries and the audit trail survive the lock.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::opening_draft_repository::OpeningDraftRepository;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use application::ports::settings_repository::SettingsRepository;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use application::use_cases::opening_balance::types::{
    CreateOpeningBalanceMigrationCommand, OpeningLineInput,
};
use application::use_cases::opening_balance::{
    ClearOpeningDraftUseCase, CreateOpeningBalanceUseCase, GetOpeningDraftUseCase,
    SaveOpeningDraftUseCase,
};
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteJournalEntryRepository, SqliteOpeningDraftRepository,
    SqliteOpeningMigrationRepository, SqliteSettingsRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_opening_lifecycle_{}.sqlite", uuid::Uuid::new_v4()));
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
    pool
}

fn settings_repo(pool: &Arc<sqlx::SqlitePool>) -> Arc<dyn SettingsRepository> {
    Arc::new(SqliteSettingsRepository::new(pool.clone()))
}

fn migration_repo(pool: &Arc<sqlx::SqlitePool>) -> Arc<dyn OpeningMigrationRepository> {
    Arc::new(SqliteOpeningMigrationRepository::new(pool.clone()))
}

fn draft_repo(pool: &Arc<sqlx::SqlitePool>) -> Arc<dyn OpeningDraftRepository> {
    Arc::new(SqliteOpeningDraftRepository::new(pool.clone()))
}

async fn set_start_mode(pool: &Arc<sqlx::SqlitePool>, mode: &str) {
    let mut settings = settings_repo(pool).get().await.unwrap();
    settings.accounting_start_mode = mode.into();
    settings_repo(pool).save(&settings).await.unwrap();
}

async fn insert_migration(pool: &sqlx::SqlitePool, id: &str, status: &str) {
    sqlx::query(
        "INSERT INTO opening_balance_migrations (id, cutover_date, status, notes, posted_at, created_at, updated_at)
         VALUES (?, datetime('now'), ?, NULL, NULL, datetime('now'), datetime('now'))",
    )
    .bind(id)
    .bind(status)
    .execute(pool)
    .await
    .unwrap();
}

async fn set_migration_status(pool: &sqlx::SqlitePool, id: &str, status: &str) {
    sqlx::query("UPDATE opening_balance_migrations SET status = ? WHERE id = ?")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await
        .unwrap();
}

async fn real_account(pool: &sqlx::SqlitePool) -> AccountId {
    let id: String = sqlx::query_scalar("SELECT id FROM accounts ORDER BY code LIMIT 1")
        .fetch_one(pool)
        .await
        .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

/// Two real account ids (FK-safe for journal_lines), like the gate tests.
async fn real_accounts(pool: &sqlx::SqlitePool) -> (AccountId, AccountId) {
    let ids: Vec<String> =
        sqlx::query_scalar("SELECT id FROM accounts ORDER BY code LIMIT 2")
            .fetch_all(pool)
            .await
            .unwrap();
    assert!(ids.len() >= 2, "chart of accounts must be seeded");
    (
        AccountId(uuid::Uuid::parse_str(&ids[0]).unwrap()),
        AccountId(uuid::Uuid::parse_str(&ids[1]).unwrap()),
    )
}

fn create_cmd(account_id: &AccountId) -> CreateOpeningBalanceMigrationCommand {
    CreateOpeningBalanceMigrationCommand {
        cutover_date: Utc::now().to_rfc3339(),
        notes: None,
        lines: vec![OpeningLineInput {
            account_id: account_id.0.to_string(),
            amount: "1000.00".into(),
            description: None,
        }],
        source_system: None,
        source_reference: None,
    }
}

fn create_uc(pool: &Arc<sqlx::SqlitePool>) -> CreateOpeningBalanceUseCase {
    CreateOpeningBalanceUseCase::new(
        migration_repo(pool),
        Arc::new(SqliteAccountRepository::new(pool.clone())),
        settings_repo(pool),
    )
}

// ---------------------------------------------------------------------------
// Creating a migration: allowed while the lifecycle is open (EXISTING), and
// rejected for NEW companies and once the migration is Locked.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn create_migration_allowed_mid_opening() {
    let pool = build_pool().await;
    let account = real_account(pool.as_ref()).await;

    let result = create_uc(&pool).execute(create_cmd(&account)).await;
    result.expect("an EXISTING company with an open lifecycle may create a migration");
}

#[tokio::test]
async fn create_migration_rejected_for_new_company() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;
    let account = real_account(pool.as_ref()).await;

    let err = create_uc(&pool)
        .execute(create_cmd(&account))
        .await
        .expect_err("a NEW company must never create an opening migration");
    assert!(matches!(err, AppError::Forbidden(_)), "expected Forbidden, got {err:?}");
}

#[tokio::test]
async fn create_migration_rejected_once_lifecycle_locked() {
    let pool = build_pool().await;
    let account = real_account(pool.as_ref()).await;
    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Locked").await;

    let err = create_uc(&pool)
        .execute(create_cmd(&account))
        .await
        .expect_err("once Locked, the lifecycle is sealed — no new migrations");
    assert!(matches!(err, AppError::Forbidden(_)), "expected Forbidden, got {err:?}");
}

#[tokio::test]
async fn create_migration_allowed_after_only_cancelled() {
    let pool = build_pool().await;
    let account = real_account(pool.as_ref()).await;
    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Cancelled").await;

    create_uc(&pool)
        .execute(create_cmd(&account))
        .await
        .expect("a merely Cancelled migration must keep the restart path open");
}

// ---------------------------------------------------------------------------
// Wizard draft saves: writable mid-opening, rejected for NEW and once Locked.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn save_draft_allowed_mid_opening() {
    let pool = build_pool().await;
    SaveOpeningDraftUseCase::new(draft_repo(&pool), settings_repo(&pool), migration_repo(&pool))
        .execute(r#"{"step":2}"#)
        .await
        .expect("draft saves are allowed while the opening lifecycle is open");
}

#[tokio::test]
async fn save_draft_rejected_for_new_company() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;

    let err = SaveOpeningDraftUseCase::new(
        draft_repo(&pool),
        settings_repo(&pool),
        migration_repo(&pool),
    )
    .execute(r#"{"step":2}"#)
    .await
    .expect_err("a NEW company must not store an opening draft");
    assert!(matches!(err, AppError::Forbidden(_)), "expected Forbidden, got {err:?}");
    assert_eq!(
        draft_repo(&pool).get().await.unwrap(),
        None,
        "rejected writes must leave no draft behind"
    );
}

#[tokio::test]
async fn save_draft_rejected_once_lifecycle_locked() {
    let pool = build_pool().await;
    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Locked").await;

    let err = SaveOpeningDraftUseCase::new(
        draft_repo(&pool),
        settings_repo(&pool),
        migration_repo(&pool),
    )
    .execute(r#"{"step":2}"#)
    .await
    .expect_err("once Locked, the opening workflow becomes read-only");
    assert!(matches!(err, AppError::Forbidden(_)), "expected Forbidden, got {err:?}");
    assert_eq!(
        draft_repo(&pool).get().await.unwrap(),
        None,
        "rejected writes must leave no draft behind"
    );
}

// ---------------------------------------------------------------------------
// No data deletion: reading the draft + clearing it survive the lock, and the
// opening journal entries stay in the ledger (audit trail intact).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn draft_read_and_clear_survive_after_lock() {
    let pool = build_pool().await;
    let snapshot = r#"{"step":5}"#.to_string();
    let drafts = draft_repo(&pool);
    SaveOpeningDraftUseCase::new(drafts.clone(), settings_repo(&pool), migration_repo(&pool))
        .execute(&snapshot)
        .await
        .unwrap();

    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Locked").await;

    // Reading is never blocked — the draft is still there (nothing deleted).
    assert_eq!(
        GetOpeningDraftUseCase::new(drafts.clone()).execute().await.unwrap(),
        Some(snapshot),
        "the draft must remain readable after the lifecycle closes"
    );
    // Clearing residue is cleanup and stays allowed even at the lock boundary.
    ClearOpeningDraftUseCase::new(drafts).execute().await.unwrap();
    assert_eq!(
        draft_repo(&pool).get().await.unwrap(),
        None,
        "clear must drop the draft residue"
    );
}

#[tokio::test]
async fn opening_journal_entries_preserved_after_lock() {
    let pool = build_pool().await;
    let (account_a, account_b) = real_accounts(pool.as_ref()).await;
    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_migration(pool.as_ref(), &migration_id, "Draft").await;

    // Post the opening balance journal while the migration is still pending.
    let currency = test_currency();
    let mut opening = JournalEntry::new(
        "9501".to_string(),
        JournalType::AccountOpeningBalance,
        vec![
            JournalLine::new(
                account_a,
                MonetaryAmount::new(Money::new(dec!(500), currency.clone()), dec!(1)),
                MonetaryAmount::zero(currency.clone()),
                "مدين افتتاحي".into(),
            ),
            JournalLine::new(
                account_b,
                MonetaryAmount::zero(currency.clone()),
                MonetaryAmount::new(Money::new(dec!(500), currency), dec!(1)),
                "دائن افتتاحي".into(),
            ),
        ],
        Utc::now(),
        "قيد الرصيد الافتتاحي".into(),
        Some(format!("opening_balance:{migration_id}")),
    )
    .unwrap();
    opening.post().unwrap();
    SqliteJournalEntryRepository::new(pool.clone())
        .save(&opening)
        .await
        .unwrap();

    // Seal the lifecycle.
    set_migration_status(pool.as_ref(), &migration_id, "Locked").await;

    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id LIKE 'opening_balance:%'",
    )
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(count, 1, "locking must NEVER delete the opening journal entries");
}