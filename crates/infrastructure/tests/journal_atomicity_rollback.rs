//! PHASE 6 STEPS 10 + 11 — Journal Layer Atomicity, Rollback, Idempotency
//!
//! Proves at the infrastructure layer that:
//!   * a composite write (journal + related rows) rolled back mid-transaction
//!     leaves ZERO partial state (no journal_entries row, no lines),
//!   * a reversal pair that fails on its second write rolls back together —
//!     the original stays Posted and no orphan reversal exists,
//!   * re-submitting the same business event (same source_type/source_id) is
//!     idempotent: exactly one ledger row, refreshed to the latest payload.

use std::str::FromStr;
use std::sync::Arc;

use application::ports::journal_entry_repository::JournalEntryRepository;
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteJournalEntryRepository;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_journal_atomicity_rollback_{}.sqlite",
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
    let pool = Arc::new(pool);
    run_migrations(&pool).await.unwrap();
    pool
}

fn line(account: AccountId, debit: Decimal, credit: Decimal) -> JournalLine {
    let c = test_currency();
    JournalLine::new(
        account,
        if debit > Decimal::ZERO {
            MonetaryAmount::new(Money::new(debit, c.clone()), dec!(1))
        } else {
            MonetaryAmount::zero(c.clone())
        },
        if credit > Decimal::ZERO {
            MonetaryAmount::new(Money::new(credit, c), dec!(1))
        } else {
            MonetaryAmount::zero(c)
        },
        "atomicity test".to_string(),
    )
}

async fn seed_account(
    pool: &sqlx::SqlitePool,
    code: &str,
    name: &str,
    account_type: &str,
    purpose: &str,
) -> AccountId {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 'Detail', 4, '0', '0', ?, 1, datetime('now'), datetime('now'))",
    )
    .bind(&id)
    .bind(code)
    .bind(name)
    .bind(name)
    .bind(account_type)
    .bind(purpose)
    .execute(pool)
    .await
    .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

fn posted_entry(
    entry_number: &str,
    lines: Vec<JournalLine>,
    source_id: Option<String>,
) -> JournalEntry {
    let mut entry = JournalEntry::new(
        entry_number.into(),
        JournalType::GeneralJournal,
        lines,
        Utc::now(),
        "atomicity test".into(),
        source_id,
    )
    .unwrap();
    entry.post().unwrap();
    entry
}

async fn count_entries(pool: &sqlx::SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn count_lines(pool: &sqlx::SqlitePool) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines")
        .fetch_one(pool)
        .await
        .unwrap()
}

// ---------------------------------------------------------------------------
// Atomicity 1: a mid-transaction failure rolls back the whole journal write
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn mid_transaction_failure_rolls_back_entire_posting() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "4001", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "4002", "Capital", "Equity", "general").await;

    let entry = posted_entry(
        "AT-001",
        vec![
            line(cash, dec!(777), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(777)),
        ],
        None,
    );

    let mut tx = pool.begin().await.unwrap();

    // Step 1 of the composite write: the journal is written inside the tx.
    repo.save_with_tx(&mut tx, &entry).await.unwrap();

    // Step 2 forces a failure inside the SAME transaction: a duplicate
    // primary key insert must blow up before commit.
    let poison = sqlx::query(
        "INSERT INTO journal_entries (id, entry_number, journal_type, entry_date, description, status, created_at, updated_at)
         VALUES (?, 'AT-PRESERVE', 'GeneralJournal', datetime('now'), 'poison row', 'Draft', datetime('now'), datetime('now'))",
    )
    .bind(entry.id.0.to_string())
    .execute(&mut *tx)
    .await;
    assert!(poison.is_err(), "poison insert must fail (duplicate PK)");

    tx.rollback().await.unwrap();

    assert_eq!(
        count_entries(&pool).await,
        0,
        "no partial journal_entries may survive a rolled-back composite write"
    );
    assert_eq!(
        count_lines(&pool).await,
        0,
        "no orphan journal_lines may survive a rolled-back composite write"
    );
}

// ---------------------------------------------------------------------------
// Atomicity 2: a reversal pair whose transaction aborts rolls back TOGETHER —
// the original stays Posted and no orphan reversal exists
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn reversal_pair_partial_failure_leaves_original_posted_and_no_orphan() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "4101", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "4102", "Capital", "Equity", "general").await;

    // Commit the original as Posted.
    let original = posted_entry(
        "AT-002",
        vec![
            line(cash, dec!(500), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(500)),
        ],
        None,
    );
    repo.save(&original).await.unwrap();

    let mut reversal = JournalEntry::create_reversal(
        &original,
        "AT-002-R".into(),
        Utc::now(),
        "reversal".into(),
    )
    .unwrap();
    let mut original_reversed = original.clone();
    original_reversed.reverse().unwrap();
    reversal.post().unwrap();

    // Write the pair inside an open transaction, then force a failure BEFORE
    // commit (a duplicate PK insert). The whole pair must roll back.
    let mut tx = pool.begin().await.unwrap();
    repo.save_reversal_pair_in_tx(&mut tx, &reversal, &original_reversed)
        .await
        .unwrap();

    let poison = sqlx::query(
        "INSERT INTO journal_entries (id, entry_number, journal_type, entry_date, description, status, created_at, updated_at)
         VALUES (?, 'AT-PRESERVE', 'GeneralJournal', datetime('now'), 'poison row', 'Draft', datetime('now'), datetime('now'))",
    )
    .bind(original.id.0.to_string())
    .execute(&mut *tx)
    .await;
    assert!(
        poison.is_err(),
        "poison insert after the pair write must fail (duplicate PK)"
    );

    tx.rollback().await.unwrap();

    // After rollback: the original is STILL Posted, no reversal exists, and the
    // ledger is untouched.
    let status: String = sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
        .bind(original.id.0.to_string())
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(status, "Posted", "original must remain Posted after failed pair");

    let reversal_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries WHERE id = ?")
            .bind(reversal.id.0.to_string())
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(reversal_count, 0, "no orphan reversal may survive");

    let linked: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE reversal_of_entry_id IS NOT NULL",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(linked, 0);
}

// ---------------------------------------------------------------------------
// Idempotency: the same business event submitted twice yields ONE ledger row
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn duplicate_event_submission_is_idempotent_single_row() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "4201", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "4202", "Capital", "Equity", "general").await;
    let source_id = "atomicity:invoice-99".to_string();

    // First submission: Dr Cash 100 / Cr Capital 100
    let first = posted_entry(
        "AT-003",
        vec![
            line(cash, dec!(100), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(100)),
        ],
        Some(source_id.clone()),
    );
    repo.save(&first).await.unwrap();

    // Second submission of the SAME event with an UPDATED payload:
    // Dr Cash 200 / Cr Capital 200
    let second = posted_entry(
        "AT-004",
        vec![
            line(cash, dec!(200), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(200)),
        ],
        Some(source_id.clone()),
    );
    repo.save(&second).await.unwrap();

    let row_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id = ? AND source_type = 'general_journal'",
    )
    .bind(&source_id)
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(
        row_count, 1,
        "the same business event must keep exactly one ledger row"
    );

    // The persisted row reflects the LATEST payload (refreshed in place).
    let (debit_base,) = sqlx::query_as::<_, (String,)>(
        "SELECT CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT)
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.source_id = ? AND je.reversal_of_entry_id IS NULL",
    )
    .bind(&source_id)
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(
        Decimal::from_str(&debit_base).unwrap(),
        dec!(200),
        "duplicate submission must refresh, not duplicate, the ledger"
    );
}