//! PHASE 5.9.3 — Golden Decimal Integration Tests
//!
//! Verifies that specific accounting scenarios produce exact Decimal results
//! through the full pipeline: TEXT storage → SQL aggregation → Decimal parsing.
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
        "acc_golden_decimal_{}.sqlite",
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
        "golden test".to_string(),
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
    journal_type: JournalType,
    lines: Vec<JournalLine>,
) {
    let mut entry = JournalEntry::new(
        entry_number.into(),
        journal_type,
        lines,
        Utc::now(),
        "golden test".into(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    repo.save(&entry).await.unwrap();
}

/// Query the aggregate_by_account pattern (safe TEXT sum)
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

    let debit = Decimal::from_str(&row.0).unwrap();
    let credit = Decimal::from_str(&row.1).unwrap();
    (debit, credit)
}

/// Query the retained_earnings_balance pattern (REAL subtraction) for a specific account.
async fn account_balance_via_real(pool: &sqlx::SqlitePool, account_id: &AccountId) -> Decimal {
    let result: Option<String> = sqlx::query_scalar(
        "SELECT CAST(COALESCE(SUM(CAST(jl.credit_base AS REAL) - CAST(jl.debit_base AS REAL)), '0') AS TEXT)
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

    let s = result.unwrap_or_else(|| "0".to_string());
    Decimal::from_str(&s).unwrap_or(Decimal::ZERO)
}

// ---------------------------------------------------------------------------
// CASE 1: Opening balance with fractional movements
//   opening = 27.00, debit = 0.10 + 0.20, credit = 0.30 → balance = 27.00
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_case_1_opening_balance_with_fractional_movements() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let asset = seed_account(&pool, "1000", "Cash", "Assets", "general").await;
    let equity = seed_account(&pool, "3000", "Capital", "Equity", "general").await;

    // Opening: Dr Cash 27.00, Cr Capital 27.00
    post_entry(
        &repo,
        "GDT-1-001",
        JournalType::GeneralJournal,
        vec![
            line(asset.clone(), dec!(27), Decimal::ZERO),
            line(equity.clone(), Decimal::ZERO, dec!(27)),
        ],
    )
    .await;

    // Dr Cash 0.10
    post_entry(
        &repo,
        "GDT-1-002",
        JournalType::GeneralJournal,
        vec![
            line(asset.clone(), dec!(0.10), Decimal::ZERO),
            line(equity.clone(), Decimal::ZERO, dec!(0.10)),
        ],
    )
    .await;

    // Dr Cash 0.20
    post_entry(
        &repo,
        "GDT-1-003",
        JournalType::GeneralJournal,
        vec![
            line(asset.clone(), dec!(0.20), Decimal::ZERO),
            line(equity.clone(), Decimal::ZERO, dec!(0.20)),
        ],
    )
    .await;

    // Cr Cash 0.30
    post_entry(
        &repo,
        "GDT-1-004",
        JournalType::GeneralJournal,
        vec![
            line(asset.clone(), Decimal::ZERO, dec!(0.30)),
            line(equity.clone(), dec!(0.30), Decimal::ZERO),
        ],
    )
    .await;

    // Assert: Cash balance = 27.00 + 0.10 + 0.20 - 0.30 = 27.00
    let (debit, credit) = aggregate_debit_credit(&pool, &asset).await;
    let balance = debit - credit;
    assert_eq!(balance, dec!(27), "CASE 1: asset balance must be exactly 27.00");
}

// ---------------------------------------------------------------------------
// CASE 2: Revenue minus expense = profit
//   revenue = 100.25, expense = 27.10 → profit = 73.15
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_case_2_revenue_minus_expense_profit() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let revenue_acc = seed_account(&pool, "4000", "Sales Revenue", "Revenue", "general").await;
    let expense_acc = seed_account(&pool, "5000", "Rent Expense", "Expenses", "general").await;
    let cash = seed_account(&pool, "1000", "Cash", "Assets", "general").await;

    // Revenue: Dr Cash 100.25, Cr Revenue 100.25
    post_entry(
        &repo,
        "GDT-2-001",
        JournalType::CashReceipt,
        vec![
            line(cash.clone(), dec!(100.25), Decimal::ZERO),
            line(revenue_acc.clone(), Decimal::ZERO, dec!(100.25)),
        ],
    )
    .await;

    // Expense: Dr Expense 27.10, Cr Cash 27.10
    post_entry(
        &repo,
        "GDT-2-002",
        JournalType::CashPayment,
        vec![
            line(expense_acc.clone(), dec!(27.10), Decimal::ZERO),
            line(cash.clone(), Decimal::ZERO, dec!(27.10)),
        ],
    )
    .await;

    // Assert: profit = revenue credit - expense debit = 100.25 - 27.10 = 73.15
    let (_, revenue_credit) = aggregate_debit_credit(&pool, &revenue_acc).await;
    let (expense_debit, _) = aggregate_debit_credit(&pool, &expense_acc).await;
    let profit = revenue_credit - expense_debit;
    assert_eq!(profit, dec!(73.15), "CASE 2: profit must be exactly 73.15");
}

// ---------------------------------------------------------------------------
// CASE 3: Distributable profit
//   retained_earnings = 40.00, current_period_profit = 12.35 → distributable = 52.35
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_case_3_distributable_profit() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let re_acc = seed_account(&pool, "3200", "Retained Earnings", "Equity", "retained_earnings").await;
    let cash = seed_account(&pool, "1000", "Cash", "Assets", "general").await;

    // Retained earnings: Dr Cash 40.00, Cr RE 40.00
    post_entry(
        &repo,
        "GDT-3-001",
        JournalType::GeneralJournal,
        vec![
            line(cash.clone(), dec!(40), Decimal::ZERO),
            line(re_acc.clone(), Decimal::ZERO, dec!(40)),
        ],
    )
    .await;

    // Current period profit: Dr Cash 12.35, Cr RE 12.35
    post_entry(
        &repo,
        "GDT-3-002",
        JournalType::GeneralJournal,
        vec![
            line(cash.clone(), dec!(12.35), Decimal::ZERO),
            line(re_acc.clone(), Decimal::ZERO, dec!(12.35)),
        ],
    )
    .await;

    // Assert: total RE credit = 52.35
    let (_, credit) = aggregate_debit_credit(&pool, &re_acc).await;
    assert_eq!(credit, dec!(52.35), "CASE 3: distributable profit via safe pattern");

    // Also test via REAL subtraction pattern
    let re_balance = account_balance_via_real(&pool, &re_acc).await;
    assert_eq!(re_balance, dec!(52.35), "CASE 3: distributable profit via REAL pattern");
}

// ---------------------------------------------------------------------------
// CASE 4: Large value addition
//   123456789.99 + 0.01 = 123456790.00
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_case_4_large_value_addition() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let asset = seed_account(&pool, "1000", "Cash", "Assets", "general").await;
    let equity = seed_account(&pool, "3000", "Capital", "Equity", "general").await;

    // Large contribution: Dr Cash 123456789.99
    post_entry(
        &repo,
        "GDT-4-001",
        JournalType::CapitalContribution,
        vec![
            line(asset.clone(), dec!(123456789.99), Decimal::ZERO),
            line(equity.clone(), Decimal::ZERO, dec!(123456789.99)),
        ],
    )
    .await;

    // Small addition: Dr Cash 0.01
    post_entry(
        &repo,
        "GDT-4-002",
        JournalType::GeneralJournal,
        vec![
            line(asset.clone(), dec!(0.01), Decimal::ZERO),
            line(equity.clone(), Decimal::ZERO, dec!(0.01)),
        ],
    )
    .await;

    // Assert: total = 123456790.00
    let (debit, _) = aggregate_debit_credit(&pool, &asset).await;
    assert_eq!(debit, dec!(123456790.00), "CASE 4: large value addition");
}

// ---------------------------------------------------------------------------
// CASE 5: A = L + E with fractional values
//   Assets = 100.25, Liabilities = 27.10, Equity = 73.15
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_case_5_accounting_equation_with_fractional() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let cash = seed_account(&pool, "1000", "Cash", "Assets", "general").await;
    let ap = seed_account(&pool, "2000", "Accounts Payable", "Liabilities", "general").await;
    let capital = seed_account(&pool, "3000", "Capital", "Equity", "general").await;

    // Sale: Dr Cash 100.25, Cr Capital 100.25
    post_entry(
        &repo,
        "GDT-5-001",
        JournalType::CashReceipt,
        vec![
            line(cash.clone(), dec!(100.25), Decimal::ZERO),
            line(capital.clone(), Decimal::ZERO, dec!(100.25)),
        ],
    )
    .await;

    // Purchase: Dr Capital 27.10, Cr AP 27.10
    post_entry(
        &repo,
        "GDT-5-002",
        JournalType::CashPayment,
        vec![
            line(capital.clone(), dec!(27.10), Decimal::ZERO),
            line(ap.clone(), Decimal::ZERO, dec!(27.10)),
        ],
    )
    .await;

    // Assert A = L + E
    let (a_debit, a_credit) = aggregate_debit_credit(&pool, &cash).await;
    let assets = a_debit - a_credit;

    let (l_debit, l_credit) = aggregate_debit_credit(&pool, &ap).await;
    let liabilities = l_credit - l_debit;

    let (e_debit, e_credit) = aggregate_debit_credit(&pool, &capital).await;
    let equity = e_credit - e_debit;

    assert_eq!(assets, dec!(100.25), "CASE 5: assets");
    assert_eq!(liabilities, dec!(27.10), "CASE 5: liabilities");
    assert_eq!(equity, dec!(73.15), "CASE 5: equity");
    assert_eq!(assets, liabilities + equity, "CASE 5: A = L + E");
}

// ---------------------------------------------------------------------------
// CASE 6: Zero balance via subtraction
//   debit = 0.10 + 0.20, credit = 0.30 → balance = 0.00
// ---------------------------------------------------------------------------

#[tokio::main(flavor = "current_thread")]
#[test]
async fn golden_case_6_zero_balance_via_fractional_subtraction() {
    let pool = build_pool().await;
    let repo = SqliteJournalEntryRepository::new(pool.clone());

    let asset = seed_account(&pool, "1000", "Cash", "Assets", "general").await;
    let expense = seed_account(&pool, "5000", "Misc Expense", "Expenses", "general").await;

    // Dr Expense 0.10, Cr Cash 0.10
    post_entry(
        &repo,
        "GDT-6-001",
        JournalType::CashPayment,
        vec![
            line(expense.clone(), dec!(0.10), Decimal::ZERO),
            line(asset.clone(), Decimal::ZERO, dec!(0.10)),
        ],
    )
    .await;

    // Dr Expense 0.20, Cr Cash 0.20
    post_entry(
        &repo,
        "GDT-6-002",
        JournalType::CashPayment,
        vec![
            line(expense.clone(), dec!(0.20), Decimal::ZERO),
            line(asset.clone(), Decimal::ZERO, dec!(0.20)),
        ],
    )
    .await;

    // Cr Expense 0.30, Dr Cash 0.30 (reversal)
    post_entry(
        &repo,
        "GDT-6-003",
        JournalType::GeneralJournal,
        vec![
            line(expense.clone(), Decimal::ZERO, dec!(0.30)),
            line(asset.clone(), dec!(0.30), Decimal::ZERO),
        ],
    )
    .await;

    // Assert: asset balance = 0
    let (debit, credit) = aggregate_debit_credit(&pool, &asset).await;
    let balance = debit - credit;
    assert_eq!(balance, dec!(0), "CASE 6: zero asset balance");

    // Assert: expense balance = 0
    let (e_debit, e_credit) = aggregate_debit_credit(&pool, &expense).await;
    let e_balance = e_debit - e_credit;
    assert_eq!(e_balance, dec!(0), "CASE 6: zero expense balance");
}
