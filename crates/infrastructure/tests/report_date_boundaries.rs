//! PHASE 6 STEPS 6 + 7 — Report Date-Boundary Semantics
//!
//! Verifies inclusive/exclusive date filtering on report aggregation at
//! nanosecond precision around period boundaries, the fiscal-year close
//! presentation split (FiscalClosing excluded from the Income Statement but
//! present in Trial Balance / Balance Sheet), monthly aggregation splits, and
//! reversal neutrality at a period boundary.
//!
//! All assertions use exact Decimal values.

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use application::ports::journal_entry_repository::JournalEntryRepository;
use chrono::{DateTime, Utc};
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

fn dt(y: i32, mo: u32, d: u32, h: u32, mi: u32, s: u32, ns: u32) -> DateTime<Utc> {
    chrono::NaiveDate::from_ymd_opt(y, mo, d)
        .unwrap()
        .and_hms_nano_opt(h, mi, s, ns)
        .unwrap()
        .and_utc()
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_report_date_boundaries_{}.sqlite",
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
        "date boundary test".to_string(),
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

async fn post_entry_at(
    repo: &SqliteJournalEntryRepository,
    entry_number: &str,
    entry_date: DateTime<Utc>,
    lines: Vec<JournalLine>,
) -> JournalEntry {
    let mut entry = JournalEntry::new(
        entry_number.into(),
        JournalType::GeneralJournal,
        lines,
        entry_date,
        "date boundary test".into(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    repo.save(&entry).await.unwrap();
    entry
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
// CASE 1: the report period is inclusive on BOTH boundaries (exact ms)
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn report_period_includes_exact_start_and_end_boundaries() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "2001", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "2002", "Capital", "Equity", "general").await;

    let period_start = dt(2024, 1, 1, 0, 0, 0, 0);
    let period_end = dt(2024, 1, 31, 23, 59, 59, 999_999_999);

    // Exactly at period start (00:00:00.000000000) → inside
    post_entry_at(
        &repo,
        "DB-001",
        period_start,
        vec![
            line(cash, dec!(10), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(10)),
        ],
    )
    .await;

    // Exactly at period end (23:59:59.999999999) → inside
    post_entry_at(
        &repo,
        "DB-002",
        period_end,
        vec![
            line(cash, dec!(20), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(20)),
        ],
    )
    .await;

    let rows = repo
        .aggregate_by_account_report_for_period(period_start, period_end)
        .await
        .unwrap();

    let (d, _) = find_aggregate(&rows, &cash).expect("cash must be present");
    assert_eq!(
        d,
        dec!(30),
        "entries at both inclusive bounds must be counted (10 + 20)"
    );
}

// ---------------------------------------------------------------------------
// CASE 2: one nanosecond outside the period is excluded
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn report_period_excludes_one_nanosecond_outside_bounds() {
    use chrono::Duration;

    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "2101", "Cash", "Assets", "general").await;
    let capital = seed_account(&pool, "2102", "Capital", "Equity", "general").await;

    let period_start = dt(2024, 3, 1, 0, 0, 0, 0);
    let period_end = dt(2024, 3, 31, 23, 59, 59, 999_999_999);

    // One nanosecond before the start → previous period
    post_entry_at(
        &repo,
        "DB-003",
        period_start - Duration::nanoseconds(1),
        vec![
            line(cash, dec!(5), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(5)),
        ],
    )
    .await;

    // One nanosecond after the end → next period
    post_entry_at(
        &repo,
        "DB-004",
        period_end + Duration::nanoseconds(1),
        vec![
            line(cash, dec!(6), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(6)),
        ],
    )
    .await;

    // One entry exactly inside
    post_entry_at(
        &repo,
        "DB-005",
        dt(2024, 3, 15, 12, 0, 0, 0),
        vec![
            line(cash, dec!(7), Decimal::ZERO),
            line(capital, Decimal::ZERO, dec!(7)),
        ],
    )
    .await;

    let rows = repo
        .aggregate_by_account_report_for_period(period_start, period_end)
        .await
        .unwrap();

    let (d, _) = find_aggregate(&rows, &cash).expect("cash must be present");
    assert_eq!(
        d,
        dec!(7),
        "only the entry strictly inside the period window may count"
    );
}

// ---------------------------------------------------------------------------
// CASE 3: fiscal-year close — FiscalClosing excluded from the Income Statement
// but present in Trial Balance / Balance Sheet
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn fiscal_closing_excluded_from_income_statement_but_present_in_tb() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "2201", "Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "2202", "Revenue", "Revenue", "general").await;
    let expense = seed_account(&pool, "2203", "Expense", "Expenses", "general").await;
    let retained = seed_account(&pool, "2204", "Retained Earnings", "Equity", "retained_earnings")
        .await;

    // Operational: Dr Cash 100 / Cr Revenue 100 ; Dr Expense 40 / Cr Cash 40
    post_entry_at(
        &repo,
        "DB-006",
        dt(2024, 12, 30, 12, 0, 0, 0),
        vec![
            line(cash, dec!(100), Decimal::ZERO),
            line(revenue, Decimal::ZERO, dec!(100)),
        ],
    )
    .await;
    post_entry_at(
        &repo,
        "DB-007",
        dt(2024, 12, 30, 12, 0, 0, 1),
        vec![
            line(expense, dec!(40), Decimal::ZERO),
            line(cash, Decimal::ZERO, dec!(40)),
        ],
    )
    .await;

    // Year-end closing (period-exempt, lands exactly on Dec 31 23:59:59.999):
    //   Dr Revenue 100 / Cr Expense 40 / Cr Retained Earnings 60
    let mut closing = JournalEntry::new(
        "DB-008".into(),
        JournalType::FiscalClosing,
        vec![
            line(revenue, dec!(100), Decimal::ZERO),
            line(expense, Decimal::ZERO, dec!(40)),
            line(retained, Decimal::ZERO, dec!(60)),
        ],
        dt(2024, 12, 31, 23, 59, 59, 999_999_999),
        "fiscal year 2024 closing".into(),
        None,
    )
    .unwrap();
    closing.post().unwrap();
    repo.save(&closing).await.unwrap();

    // Income Statement (report aggregation) excludes the closing entry:
    // revenue still shows its operational 100, expense its operational 40.
    let is_rows = repo.aggregate_by_account_report().await.unwrap();
    let (_, rev_c) = find_aggregate(&is_rows, &revenue).expect("revenue present in IS");
    let (exp_d, _) = find_aggregate(&is_rows, &expense).expect("expense present in IS");
    assert_eq!(rev_c, dec!(100), "IS revenue must stay operational (no closing)");
    assert_eq!(exp_d, dec!(40), "IS expense must stay operational (no closing)");

    // Trial Balance (inclusive aggregation) includes the closing: Revenue and
    // Expense are zeroed and the profit sits in Retained Earnings.
    let tb_rows = repo.aggregate_by_account().await.unwrap();
    let (rev_d, rev_c_tb) = find_aggregate(&tb_rows, &revenue).expect("revenue in TB");
    let (exp_d_tb, exp_c) = find_aggregate(&tb_rows, &expense).expect("expense in TB");
    let (_, re_c) = find_aggregate(&tb_rows, &retained).expect("retained earnings in TB");
    assert_eq!(rev_d, rev_c_tb, "revenue zeroed after close in TB (dr==cr)");
    assert_eq!(exp_d_tb, exp_c, "expense zeroed after close in TB (dr==cr)");
    assert_eq!(
        re_c,
        dec!(60),
        "the 60 profit must be booked into retained earnings"
    );
}

// ---------------------------------------------------------------------------
// CASE 4: fiscal-close boundary is visible to the Income Statement window for
// the closed year, and the close belongs to the year it was dated in
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn fiscal_close_lands_in_the_income_statement_window_of_its_date() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "2301", "Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "2302", "Revenue", "Revenue", "general").await;
    let retained = seed_account(&pool, "2303", "Retained Earnings", "Equity", "retained_earnings")
        .await;

    post_entry_at(
        &repo,
        "DB-009",
        dt(2024, 12, 31, 12, 0, 0, 0),
        vec![
            line(cash, dec!(250), Decimal::ZERO),
            line(revenue, Decimal::ZERO, dec!(250)),
        ],
    )
    .await;

    // Closing dated Dec 31 2024 23:59:59.999
    let mut closing = JournalEntry::new(
        "DB-010".into(),
        JournalType::FiscalClosing,
        vec![
            line(revenue, dec!(250), Decimal::ZERO),
            line(retained, Decimal::ZERO, dec!(250)),
        ],
        dt(2024, 12, 31, 23, 59, 59, 999_999_999),
        "closing".into(),
        None,
    )
    .unwrap();
    closing.post().unwrap();
    repo.save(&closing).await.unwrap();

    // Year-window report: the closing is dated inside the window, so by the
    // report policy it is EXCLUDED (income statement view) → revenue intact.
    let rows = repo
        .aggregate_by_account_report_for_period(
            dt(2024, 1, 1, 0, 0, 0, 0),
            dt(2024, 12, 31, 23, 59, 59, 999_999_999),
        )
        .await
        .unwrap();
    let (_, rev_c) = find_aggregate(&rows, &revenue).expect("revenue in report");
    assert_eq!(rev_c, dec!(250), "closing entry excluded from IS window");

    // The same window over the inclusive Trial Balance aggregation includes
    // the closing → revenue zeroed, retained earnings credited.
    let tb_rows = repo
        .aggregate_by_account_for_period(
            dt(2024, 1, 1, 0, 0, 0, 0),
            dt(2024, 12, 31, 23, 59, 59, 999_999_999),
        )
        .await
        .unwrap();
    let (rev_d, rev_c_tb) = find_aggregate(&tb_rows, &revenue).expect("revenue in TB window");
    let (_, re_c) = find_aggregate(&tb_rows, &retained).expect("RE in TB window");
    assert_eq!(rev_d, rev_c_tb);
    assert_eq!(re_c, dec!(250));
}

// ---------------------------------------------------------------------------
// CASE 5: reversal at the boundary is neutral on BOTH sides of the ledger
// (the reversal relationship keeps either side out of aggregates — posted-ledger
// policy), and monthly aggregation splits the same account across months.
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn cross_period_reversal_is_neutral_and_monthly_split_is_exact() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "2401", "Cash", "Assets", "general").await;
    let revenue = seed_account(&pool, "2402", "Sales (monthly)", "Revenue", "general").await;

    // January revenue, reversed in February (one nanosecond into the new month)
    let original = post_entry_at(
        &repo,
        "DB-011",
        dt(2024, 1, 31, 23, 59, 59, 0),
        vec![
            line(cash, dec!(99), Decimal::ZERO),
            line(revenue, Decimal::ZERO, dec!(99)),
        ],
    )
    .await;

    let mut reversal = JournalEntry::create_reversal(
        &original,
        "DB-011-R".into(),
        dt(2024, 2, 1, 0, 0, 0, 1),
        "reversal in feb".into(),
    )
    .unwrap();
    let mut original_reversed = original.clone();
    original_reversed.reverse().unwrap();
    reversal.post().unwrap();
    repo.save_reversal_pair(&reversal, &original_reversed)
        .await
        .unwrap();

    // Posted-ledger policy: neither side of the reversal pair may reach a
    // report → January window shows zero revenue, February shows zero too.
    for (from, to) in [
        (
            dt(2024, 1, 1, 0, 0, 0, 0),
            dt(2024, 1, 31, 23, 59, 59, 999_999_999),
        ),
        (
            dt(2024, 2, 1, 0, 0, 0, 0),
            dt(2024, 2, 29, 23, 59, 59, 999_999_999),
        ),
    ] {
        let rows = repo
            .aggregate_by_account_report_for_period(from, to)
            .await
            .unwrap();
        assert!(
            !rows.iter().any(|r| r.account_id == revenue),
            "reversal pair must stay out of every report window"
        );
    }

    // Cross-check the relation is truly one pair (single reversal relationship)
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_entries WHERE reversal_of_entry_id IS NOT NULL",
    )
    .fetch_one(&*pool)
    .await
    .unwrap();
    assert_eq!(count, 1);

    // Monthly revenue/expenses: January has zero (reversed out), and a fresh
    // February sale lands in February.
    post_entry_at(
        &repo,
        "DB-012",
        dt(2024, 2, 15, 10, 0, 0, 0),
        vec![
            line(cash, dec!(33), Decimal::ZERO),
            line(revenue, Decimal::ZERO, dec!(33)),
        ],
    )
    .await;

    let monthly = repo
        .aggregate_monthly_revenue_expenses(None, None)
        .await
        .unwrap();
    let by_month: HashMap<String, Decimal> = monthly
        .into_iter()
        .map(|m| (m.year_month.clone(), m.revenue))
        .collect();

    assert_eq!(by_month.get("2024-02").copied(), Some(dec!(33)));
    assert_eq!(by_month.get("2024-01").copied(), None, "reversed-out Jan clean");
}