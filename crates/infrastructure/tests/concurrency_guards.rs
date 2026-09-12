//! PHASE 6 STEP 12 — Practical SQLite Concurrency Guards
//!
//! SQLite is a single-writer engine and this repository's transactions are
//! deferred, so concurrent writers on multiple connections produce
//! SQLITE_BUSY/BUSY_SNAPSHOT — the app serializes writes through single-writer
//! pools and relies on the entry-number allocator plus UNIQUE constraints as the
//! true concurrency backstop. These tests verify the guarantees the engine
//! ACTUALLY provides under the production pool recipe (WAL + busy_timeout):
//!   * the entry-number allocator yields unique, consecutive numbers under
//!     concurrent allocation from multiple connections,
//!   * concurrent READERS observe a complete, always-balanced ledger while a
//!     writer streams COMMITs on another connection (WAL snapshot isolation),
//!   * the allocator stays strictly ahead of every number already posted, so a
//!     fresh allocation can never collide with ledger history.

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

async fn build_pool(connections: u32) -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_concurrency_guards_{}.sqlite",
        uuid::Uuid::new_v4()
    ));
    let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
        .unwrap()
        .create_if_missing(true)
        // Mirror the production pool (db/pool.rs): WAL + busy timeout + FKs.
        .busy_timeout(std::time::Duration::from_secs(30))
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(connections)
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
        "concurrency test".to_string(),
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

async fn ledger_totals(pool: &sqlx::SqlitePool) -> (Decimal, Decimal) {
    let (d, c): (String, String) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT),
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT)
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted' AND je.reversal_of_entry_id IS NULL",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    (
        Decimal::from_str(&d).unwrap(),
        Decimal::from_str(&c).unwrap(),
    )
}

// ---------------------------------------------------------------------------
// CASE 1: concurrent allocation yields unique, consecutive entry numbers
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_entry_number_allocation_is_unique() {
    let pool = build_pool(4).await;

    let mut handles = Vec::new();
    for _ in 0..10 {
        let pool = pool.clone();
        handles.push(tokio::spawn(async move {
            let repo = SqliteJournalEntryRepository::new(pool);
            let n = repo.get_next_entry_number().await.unwrap();
            n.parse::<i64>().expect("number must be an integer")
        }));
    }

    let mut numbers = Vec::new();
    for h in handles {
        numbers.push(h.await.unwrap());
    }

    numbers.sort_unstable();
    let mut unique = numbers.clone();
    unique.dedup();
    assert_eq!(
        unique.len(),
        numbers.len(),
        "concurrent allocation must never hand out the same entry number twice"
    );
    assert_eq!(numbers.len(), 10);
    assert!(
        numbers.windows(2).all(|w| w[1] == w[0] + 1),
        "allocated numbers must be consecutive and strictly increasing: {:?}",
        numbers
    );
}

// ---------------------------------------------------------------------------
// CASE 2: concurrent readers never observe a torn ledger while writes stream
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_readers_observe_balanced_ledger_while_writer_commits() {
    let pool = build_pool(5).await;

    let cash = seed_account(&pool, "5001", "Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "5002", "Revenue", "Revenue", "general").await;

    // Writer connection streams 12 balanced commits.
    let writer_pool = pool.clone();
    let w_cash = cash;
    let w_rev = revenue;
    let writer = tokio::spawn(async move {
        let repo = SqliteJournalEntryRepository::new(writer_pool);
        for i in 0..12u32 {
            let amount = Decimal::from(i + 1);
            let mut entry = JournalEntry::new(
                format!("CG-{:04}", 7000 + i),
                JournalType::GeneralJournal,
                vec![
                    line(w_cash, amount, Decimal::ZERO),
                    line(w_rev, Decimal::ZERO, amount),
                ],
                Utc::now(),
                "concurrent stream".into(),
                Some(format!("stream:{}", i)),
            )
            .unwrap();
            entry.post().unwrap();
            repo.save(&entry).await.unwrap();
        }
    });

    // Concurrent readers hit the report aggregates on their own connections.
    // WAL snapshot isolation means every observed committed state is whole and
    // balanced — never a torn half-entry.
    let mut readers = Vec::new();
    for _ in 0..24 {
        let pool = pool.clone();
        readers.push(tokio::spawn(async move {
            let rows = SqliteJournalEntryRepository::new(pool)
                .aggregate_by_account_report()
                .await
                .unwrap();
            let total_debit: Decimal = rows.iter().map(|r| r.total_debit_base).sum();
            let total_credit: Decimal = rows.iter().map(|r| r.total_credit_base).sum();
            assert_eq!(
                total_debit, total_credit,
                "a reader must never observe a torn/unbalanced ledger"
            );
        }));
    }

    writer.await.unwrap();
    for r in readers {
        r.await.unwrap();
    }

    let entries: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&*pool)
        .await
        .unwrap();
    let lines: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_lines")
        .fetch_one(&*pool)
        .await
        .unwrap();
    let (total_d, total_c) = ledger_totals(&pool).await;
    assert_eq!(entries, 12);
    assert_eq!(lines, 24);
    assert_eq!(total_d, total_c);
    assert_eq!(total_d, dec!(78), "1+2+...+12 = 78 on each side");
}

// ---------------------------------------------------------------------------
// CASE 3: the allocator stays strictly ahead of every posted number
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn allocator_stays_ahead_of_all_posted_numbers() {
    let pool = build_pool(1).await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "5201", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "5202", "Capital", "Equity", "general").await;

    // Post entries with explicit legacy-style numbers, then take one allocator
    // number and verify it exceeds every posted number.
    for (number, amount) in [("8201", dec!(10)), ("8207", dec!(20)), ("8999", dec!(30))] {
        let mut entry = JournalEntry::new(
            number.into(),
            JournalType::GeneralJournal,
            vec![
                line(cash, amount, Decimal::ZERO),
                line(capital, Decimal::ZERO, amount),
            ],
            Utc::now(),
            "vector post".into(),
            None,
        )
        .unwrap();
        entry.post().unwrap();
        repo.save(&entry).await.unwrap();
    }

    let max_posted: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(CAST(entry_number AS INTEGER)), 0) FROM journal_entries")
            .fetch_one(&*pool)
            .await
            .unwrap();
    assert_eq!(max_posted, 8999);

    // Three allocations must ride strictly above 8999, consecutively, never
    // colliding with ledger history.
    let a = repo.get_next_entry_number().await.unwrap().parse::<i64>().unwrap();
    let b = repo.get_next_entry_number().await.unwrap().parse::<i64>().unwrap();
    let c = repo.get_next_entry_number().await.unwrap().parse::<i64>().unwrap();

    assert!(a > max_posted, "allocator must stay ahead of posted history");
    assert_eq!(b, a + 1);
    assert_eq!(c, a + 2);
}