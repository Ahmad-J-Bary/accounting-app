//! Existing-company opening gate.
//!
//! `validate_opening_gate` (journal_entry/commands.rs) forbids persisting normal
//! Posted operational journals while an EXISTING company still has an
//! unsealed opening migration (status NOT IN Cancelled/Locked). Opening-workflow
//! journals are exempt (period-exempt types or the opening pivot source ids).
//! NEW-mode companies never carry a migration so the gate is a no-op for them.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::ports::settings_repository::SettingsRepository;
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use application::use_cases::opening_balance::create::START_MODE_EXISTING;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{SqliteJournalEntryRepository, SqliteSettingsRepository};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("S", "عملة أساسية", "Base", "B", 2, true)
}

fn balanced_lines(amount: Decimal, account_a: AccountId, account_b: AccountId) -> Vec<JournalLine> {
    let c = test_currency();
    vec![
        JournalLine::new(
            account_a,
            MonetaryAmount::new(Money::new(amount, c.clone()), dec!(1)),
            MonetaryAmount::zero(c.clone()),
            "مدين".to_string(),
        ),
        JournalLine::new(
            account_b,
            MonetaryAmount::zero(c.clone()),
            MonetaryAmount::new(Money::new(amount, c), dec!(1)),
            "دائن".to_string(),
        ),
    ]
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_opening_gate_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn set_start_mode(pool: &Arc<sqlx::SqlitePool>, mode: &str) {
    let settings_repo = Arc::new(SqliteSettingsRepository::new(pool.clone()));
    let mut settings = settings_repo.get().await.unwrap();
    settings.accounting_start_mode = mode.into();
    settings_repo.save(&settings).await.unwrap();
}

/// Two real account ids from the seeded chart of accounts (FK-safe for journal_lines).
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

/// Inserts a migration header row (schema from migrations 139/140).
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

/// Posts a balanced journal through the real repository (which runs the gate).
async fn post_normal_journal(
    pool: &Arc<sqlx::SqlitePool>,
    entry_number: &str,
    source_id: Option<String>,
    journal_type: JournalType,
) -> Result<(), AppError> {
    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;
    let mut entry = JournalEntry::new(
        entry_number.to_string(),
        journal_type,
        balanced_lines(dec!(500), acc_a, acc_b),
        Utc::now(),
        "قيد اختبار بوابة الرصيد الافتتاحي".to_string(),
        source_id,
    )
    .unwrap();
    entry.post().unwrap();
    SqliteJournalEntryRepository::new(pool.clone()).save(&entry).await
}

// ---------------------------------------------------------------------------
// Rejected: EXISTING + a pending (Draft) migration blocks a normal GeneralJournal.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn gate_rejects_normal_journal_while_draft_migration_pending() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Draft").await;

    let err = post_normal_journal(&pool, "9001", None, JournalType::GeneralJournal)
        .await
        .expect_err("normal journal must be blocked while a Draft migration exists");
    assert!(matches!(err, AppError::Forbidden(_)), "expected Forbidden, got {err:?}");
}

// ---------------------------------------------------------------------------
// Rejected: the same applies for a Posted-but-not-locked migration.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn gate_rejects_normal_journal_while_posted_migration_pending() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Posted").await;

    let err = post_normal_journal(&pool, "9002", None, JournalType::GeneralJournal)
        .await
        .expect_err("normal journal must be blocked until the migration is Locked");
    assert!(matches!(err, AppError::Forbidden(_)), "expected Forbidden, got {err:?}");
}

// ---------------------------------------------------------------------------
// Accepted: an opening-balance journal (AccountOpeningBalance + pivot source)
// is always allowed, even with a pending migration.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn gate_allows_opening_journal_while_pending() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_migration(pool.as_ref(), &migration_id, "Draft").await;

    let result = post_normal_journal(
        &pool,
        "9003",
        Some(format!("opening_balance:{migration_id}")),
        JournalType::AccountOpeningBalance,
    )
    .await;
    result.expect("opening-balance posting is period-exempt and must pass the gate");

    // And the residual reclassification (a GeneralJournal carrying the pivot
    // source id) must also survive the gate while the migration is still Posted.
    let result = post_normal_journal(
        &pool,
        "9004",
        Some(format!("residual_classification:{migration_id}")),
        JournalType::GeneralJournal,
    )
    .await;
    result.expect("residual reclassification posts a GeneralJournal and must be exempt");
}

// ---------------------------------------------------------------------------
// Accepted: once the migration is Locked the gate lifts for normal journals.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn gate_allows_normal_journal_once_migration_locked() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    let migration_id = uuid::Uuid::new_v4().to_string();
    insert_migration(pool.as_ref(), &migration_id, "Draft").await;
    set_migration_status(pool.as_ref(), &migration_id, "Locked").await;

    post_normal_journal(&pool, "9005", None, JournalType::GeneralJournal)
        .await
        .expect("normal journal must be allowed once the migration is Locked");
}

// ---------------------------------------------------------------------------
// Accepted: a Cancelled migration leaves no pending state → gate lifts.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn gate_allows_when_only_cancelled_migration() {
    let pool = build_pool().await;
    set_start_mode(&pool, START_MODE_EXISTING).await;
    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Cancelled").await;

    post_normal_journal(&pool, "9006", None, JournalType::GeneralJournal)
        .await
        .expect("a merely Cancelled migration must not block normal posting");
}

// ---------------------------------------------------------------------------
// Accepted: NEW-mode companies are never gated, even with a stray migration row.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn gate_is_a_noop_for_new_companies() {
    let pool = build_pool().await;
    set_start_mode(&pool, "NewCompany").await;
    insert_migration(pool.as_ref(), &uuid::Uuid::new_v4().to_string(), "Draft").await;

    post_normal_journal(&pool, "9007", None, JournalType::GeneralJournal)
        .await
        .expect("NEW companies are never gated regardless of stray migration rows");
}