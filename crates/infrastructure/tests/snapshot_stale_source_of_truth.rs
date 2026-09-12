//! PHASE 6 STEP 5 — Invariant 9: `journal_lines` is the sole source of truth.
//!
//! Reports must be computed FROM journal_lines, never from the denormalized
//! `accounts.balance / debit / credit / opening_balance` snapshot columns. This
//! suite corrupts those snapshot columns with absurd values and proves every
//! report aggregation is byte-for-byte unchanged.
//!
//! All assertions use exact Decimal values.

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
        "acc_snapshot_stale_{}.sqlite",
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
        "source-of-truth test".to_string(),
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

async fn post_entry(
    repo: &SqliteJournalEntryRepository,
    entry_number: &str,
    lines: Vec<JournalLine>,
) -> JournalEntry {
    let mut entry = JournalEntry::new(
        entry_number.into(),
        JournalType::GeneralJournal,
        lines,
        Utc::now(),
        "source-of-truth test".into(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    repo.save(&entry).await.unwrap();
    entry
}

/// Corrupts the denormalized snapshot columns with absurd values.
async fn corrupt_snapshots(pool: &sqlx::SqlitePool, ids: &[&AccountId]) {
    for id in ids {
        sqlx::query(
            "UPDATE accounts SET balance = '99999999.99', debit = '88888888.88',
                credit = '77777777.77', opening_balance = '66666666.66' WHERE id = ?",
        )
        .bind(id.0.to_string())
        .execute(pool)
        .await
        .unwrap();
    }
}

fn find_aggregate(
    rows: &[application::ports::journal_entry_repository::AccountAggregationRow],
    account: &AccountId,
) -> Option<(Decimal, Decimal)> {
    rows.iter()
        .find(|r| &r.account_id == account)
        .map(|r| (r.total_debit_base, r.total_credit_base))
}

// ---------------------------------------------------------------------------
// Invariant 9a: account aggregates ignore stale snapshot columns
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn stale_snapshot_columns_do_not_leak_into_reports() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "3001", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "3002", "Capital", "Equity", "general").await;

    post_entry(
        &repo,
        "ST-001",
        vec![
            line(cash, Decimal::from_str("123.45").unwrap(), Decimal::ZERO),
            line(capital, Decimal::ZERO, Decimal::from_str("123.45").unwrap()),
        ],
    )
    .await;

    let before = repo.aggregate_by_account_report().await.unwrap();
    let (cash_d_before, _) = find_aggregate(&before, &cash).unwrap();
    let (_, cap_c_before) = find_aggregate(&before, &capital).unwrap();

    corrupt_snapshots(&pool, &[&cash, &capital]).await;

    let after = repo.aggregate_by_account_report().await.unwrap();
    let (cash_d_after, _) = find_aggregate(&after, &cash).unwrap();
    let (_, cap_c_after) = find_aggregate(&after, &capital).unwrap();

    assert_eq!(cash_d_after, cash_d_before);
    assert_eq!(cap_c_after, cap_c_before);
    assert_eq!(cash_d_after, Decimal::from_str("123.45").unwrap());
    assert_eq!(cap_c_after, Decimal::from_str("123.45").unwrap());
}

// ---------------------------------------------------------------------------
// Invariant 9b: retained earnings derive from journal_lines, not snapshots
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn stale_snapshots_do_not_change_retained_earnings() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "3101", "Cash", "Assets", "general").await;
    let retained = seed_account(&pool, "3102", "Retained Earnings", "Equity", "retained_earnings")
        .await;

    post_entry(
        &repo,
        "ST-002",
        vec![
            line(cash, dec!(77), Decimal::ZERO),
            line(retained, Decimal::ZERO, dec!(77)),
        ],
    )
    .await;
    post_entry(
        &repo,
        "ST-003",
        vec![
            line(cash, dec!(22), Decimal::ZERO),
            line(retained, Decimal::ZERO, dec!(22)),
        ],
    )
    .await;

    let before = repo.retained_earnings_balance(None).await.unwrap();
    assert_eq!(before, dec!(99));

    corrupt_snapshots(&pool, &[&cash, &retained]).await;

    let after = repo.retained_earnings_balance(None).await.unwrap();
    assert_eq!(
        after, dec!(99),
        "retained earnings must come from journal_lines only"
    );
}

// ---------------------------------------------------------------------------
// Invariant 9c: A = L + E holds from journal_lines even with stale snapshots
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn accounting_equation_holds_from_journal_lines_despite_stale_snapshots() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "3201", "Cash", "Assets", "general").await;
    let payable = seed_account(&pool, "3202", "Payable", "Liabilities", "general").await;
    let capital = seed_account(&pool, "3203", "Capital", "Equity", "general").await;

    post_entry(
        &repo,
        "ST-004",
        vec![
            line(cash, dec!(100), Decimal::ZERO),
            line(payable, Decimal::ZERO, dec!(40)),
            line(capital, Decimal::ZERO, dec!(60)),
        ],
    )
    .await;

    corrupt_snapshots(&pool, &[&cash, &payable, &capital]).await;

    let rows = repo.aggregate_by_account().await.unwrap();
    let (cash_d, _) = find_aggregate(&rows, &cash).unwrap();
    let (_, pay_c) = find_aggregate(&rows, &payable).unwrap();
    let (_, cap_c) = find_aggregate(&rows, &capital).unwrap();

    assert_eq!(
        cash_d,
        pay_c + cap_c,
        "A = L + E must be computable purely from journal_lines"
    );
    assert_eq!(cash_d, dec!(100));
    assert_eq!(pay_c + cap_c, dec!(100));
}

// ---------------------------------------------------------------------------
// Invariant 9d: reversal neutrality also ignores stale snapshot columns
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn reversed_pair_stays_neutral_even_with_stale_snapshots() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "3301", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "3302", "Capital", "Equity", "general").await;

    let original = post_entry(
        &repo,
        "ST-005",
        vec![
            line(cash, dec!(55), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(55)),
        ],
    )
    .await;

    let mut reversal = JournalEntry::create_reversal(
        &original,
        "ST-005-R".into(),
        Utc::now(),
        "neutrality".into(),
    )
    .unwrap();
    let mut original_reversed = original.clone();
    original_reversed.reverse().unwrap();
    reversal.post().unwrap();
    repo.save_reversal_pair(&reversal, &original_reversed)
        .await
        .unwrap();

    corrupt_snapshots(&pool, &[&cash, &capital]).await;

    let rows = repo.aggregate_by_account_report().await.unwrap();
    assert!(
        !rows.iter().any(|r| r.account_id == cash || r.account_id == capital),
        "a reversed pair must not reach reports regardless of snapshots"
    );
    let (total_d, total_c) = sqlx::query_as::<_, (String, String)>(
        "SELECT CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT),
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT)
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted' AND je.reversal_of_entry_id IS NULL",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(
        Decimal::from_str(&total_d).unwrap(),
        Decimal::from_str(&total_c).unwrap(),
        "posted-ledger trial balance stays balanced after the pair"
    );
    assert_eq!(Decimal::from_str(&total_d).unwrap(), Decimal::ZERO);
}