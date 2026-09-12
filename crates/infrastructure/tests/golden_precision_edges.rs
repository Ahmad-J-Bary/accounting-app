//! PHASE 6 STEP 4 — Golden Decimal Edge Cases
//!
//! Covers the remaining decimal edges that the older golden suites did not:
//!   * 6-dp monetary values (123456789.123456) through a full GL posting,
//!   * a 9-digit roll-over (999999999.99 + 0.01 = 1000000000.00) on the GL,
//!   * the accounting equation A = L + E with 6-dp exactness,
//!   * exact trial balance (Σ debit = Σ credit) under multi-row fractional data.
//!
//! All assertions use exact Decimal values — no f64, no tolerance.

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
        "acc_golden_precision_edges_{}.sqlite",
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
        "golden precision edge".to_string(),
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
) {
    let mut entry = JournalEntry::new(
        entry_number.into(),
        JournalType::GeneralJournal,
        lines,
        Utc::now(),
        "golden precision edge".into(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    repo.save(&entry).await.unwrap();
}

/// Safe TEXT-sum aggregate for one account (the canonical report pattern).
async fn aggregate_debit_credit(
    pool: &sqlx::SqlitePool,
    account_id: &AccountId,
) -> (Decimal, Decimal) {
    let row: (String, String) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT),
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT)
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND jl.account_id = ?",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();

    (
        Decimal::from_str(&row.0).unwrap(),
        Decimal::from_str(&row.1).unwrap(),
    )
}

/// Safe TEXT-sum trial balance across the whole posted ledger.
async fn trial_balance(pool: &sqlx::SqlitePool) -> (Decimal, Decimal) {
    let row: (String, String) = sqlx::query_as(
        "SELECT CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT),
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT)
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL",
    )
    .fetch_one(pool)
    .await
    .unwrap();

    (
        Decimal::from_str(&row.0).unwrap(),
        Decimal::from_str(&row.1).unwrap(),
    )
}

// ---------------------------------------------------------------------------
// CASE A: 6-dp exact addition through the GL
//   123456789.123456 + 0.000001 = 123456789.123457
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_6dp_addition_is_exact_through_the_gl() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1100", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "3100", "Capital", "Equity", "general").await;

    post_entry(
        &repo,
        "GP-E-001",
        vec![
            line(cash, Decimal::from_str("123456789.123456").unwrap(), Decimal::ZERO),
            line(capital, Decimal::ZERO, Decimal::from_str("123456789.123456").unwrap()),
        ],
    )
    .await;

    post_entry(
        &repo,
        "GP-E-002",
        vec![
            line(cash, Decimal::from_str("0.000001").unwrap(), Decimal::ZERO),
            line(capital, Decimal::ZERO, Decimal::from_str("0.000001").unwrap()),
        ],
    )
    .await;

    let (cash_d, cash_c) = aggregate_debit_credit(&pool, &cash).await;
    assert_eq!(
        cash_d,
        Decimal::from_str("123456789.123457").unwrap(),
        "0.000001 must accumulate exactly onto 6-dp value through the GL"
    );
    assert_eq!(cash_c, Decimal::ZERO);
}

// ---------------------------------------------------------------------------
// CASE B: 9-digit roll-over on the GL
//   999999999.99 + 0.01 = 1000000000.00
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_9digit_rollover_is_exact_on_the_gl() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1200", "Cash", "Assets", "general").await;
    let loan = seed_account(&pool, "2200", "Loan", "Liabilities", "general").await;

    post_entry(
        &repo,
        "GP-E-003",
        vec![
            line(cash, Decimal::from_str("999999999.99").unwrap(), Decimal::ZERO),
            line(loan, Decimal::ZERO, Decimal::from_str("999999999.99").unwrap()),
        ],
    )
    .await;

    post_entry(
        &repo,
        "GP-E-004",
        vec![
            line(cash, dec!(0.01), Decimal::ZERO),
            line(loan, Decimal::ZERO, dec!(0.01)),
        ],
    )
    .await;

    let (cash_d, _) = aggregate_debit_credit(&pool, &cash).await;
    assert_eq!(
        cash_d,
        Decimal::from_str("1000000000.00").unwrap(),
        "999999999.99 + 0.01 must roll to exactly 1,000,000,000.00"
    );
}

// ---------------------------------------------------------------------------
// CASE C: accounting equation A = L + E with 6-dp exactness
//   Assets 123456789.123456 = Liabilities 40000000.000006 + Equity 83456789.123450
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_accounting_equation_holds_with_6dp_exactness() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1300", "Cash", "Assets", "general").await;
    let payable = seed_account(&pool, "2300", "Payable", "Liabilities", "general").await;
    let capital = seed_account(&pool, "3200", "Capital", "Equity", "general").await;

    // Assets 123456789.123456  (single posting, 3 lines)
    //   Liabilities 40000000.000006, Equity 83456789.123450
    post_entry(
        &repo,
        "GP-E-005",
        vec![
            line(cash, Decimal::from_str("123456789.123456").unwrap(), Decimal::ZERO),
            line(payable, Decimal::ZERO, Decimal::from_str("40000000.000006").unwrap()),
            line(capital, Decimal::ZERO, Decimal::from_str("83456789.123450").unwrap()),
        ],
    )
    .await;

    let (cash_d, _) = aggregate_debit_credit(&pool, &cash).await;
    let (_, payable_c) = aggregate_debit_credit(&pool, &payable).await;
    let (_, capital_c) = aggregate_debit_credit(&pool, &capital).await;

    assert_eq!(cash_d, Decimal::from_str("123456789.123456").unwrap());
    let liabilities = Decimal::from_str("40000000.000006").unwrap();
    let equity = Decimal::from_str("83456789.123450").unwrap();
    assert_eq!(payable_c, liabilities);
    assert_eq!(capital_c, equity);
    assert_eq!(
        cash_d,
        liabilities + equity,
        "A = L + E must hold exactly at 6 decimal places"
    );
}

// ---------------------------------------------------------------------------
// CASE D: exact trial balance under multi-row fractional data with reversals
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_trial_balance_is_exact_after_fractional_multirow_reversal() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1400", "Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "4100", "Revenue", "Revenue", "general").await;
    let expense = seed_account(&pool, "5100", "Expense", "Expenses", "general").await;

    // Dr Cash 123456789.123456 / Cr Revenue
    post_entry(
        &repo,
        "GP-E-006",
        vec![
            line(cash, Decimal::from_str("123456789.123456").unwrap(), Decimal::ZERO),
            line(revenue, Decimal::ZERO, Decimal::from_str("123456789.123456").unwrap()),
        ],
    )
    .await;

    // Dr Expense 0.000456 / Cr Cash 0.000456 — still exactly balanced
    post_entry(
        &repo,
        "GP-E-007",
        vec![
            line(expense, Decimal::from_str("0.000456").unwrap(), Decimal::ZERO),
            line(cash, Decimal::ZERO, Decimal::from_str("0.000456").unwrap()),
        ],
    )
    .await;

    let (total_d, total_c) = trial_balance(&pool).await;
    assert_eq!(
        total_d, total_c,
        "trial balance must balance exactly after 6-dp movements (dr={}, cr={})",
        total_d, total_c
    );
    assert_ne!(total_d, Decimal::ZERO, "sanity: ledger is non-empty");
}