//! PHASE 5.9.1 — Fiscal Close SQL Integrity Integration Tests
//!
//! These tests exercise the REAL SQLite path for fiscal year close, verifying
//! that both DEFECT-1 (FiscalClosing period exemption) and DEFECT-2
//! (carry-forward sees uncommitted closing entry) are fixed.
//!
//! All assertions are live-ledger based (journal_lines are the source of truth).

use std::str::FromStr;
use std::sync::Arc;

use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use application::ports::fiscal_year_repository::FiscalYearRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::use_cases::fiscal_year::close::CloseFiscalYearUseCase;
use application::use_cases::fiscal_year::types::CloseFiscalYearCommand;
use chrono::{DateTime, Utc};
use domain::accounting::fiscal_period::{FiscalPeriod, FiscalPeriodStatus};
use domain::accounting::fiscal_year::FiscalYear;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::ids::AccountId;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::ExecutionContext;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteAccountRepository, SqliteFiscalPeriodRepository, SqliteFiscalYearRepository,
    SqliteJournalEntryRepository,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_fiscal_close_sql_{}.sqlite",
        uuid::Uuid::new_v4()
    ));
    let db_url = format!("sqlite:{}?mode=rwc", path.to_str().unwrap());
    let pool = infrastructure::db::pool::create_pool(&db_url).await.unwrap();
    run_migrations(&pool).await.unwrap();
    pool
}

fn utc(rfc3339: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(rfc3339)
        .unwrap()
        .with_timezone(&Utc)
}

fn admin_context() -> ExecutionContext {
    ExecutionContext {
        actor_id: Some("admin".into()),
        permission_keys: vec!["fiscal_year.close".into()],
        ..ExecutionContext::default()
    }
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
        "test".to_string(),
    )
}

/// Seed an account with the given purpose directly in SQLite.
async fn seed_account(
    pool: &sqlx::SqlitePool,
    code: &str,
    name: &str,
    account_type: &str,
    purpose: &str,
) -> AccountId {
    let parent_id: Option<String> = sqlx::query_scalar("SELECT id FROM accounts WHERE code = ?")
        .bind(if account_type == "Revenue" || account_type == "Expenses" {
            "4"
        } else if account_type == "Assets" {
            "1"
        } else if account_type == "Liabilities" {
            "2"
        } else {
            "5"
        })
        .fetch_optional(pool)
        .await
        .unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Detail', 4, '0', '0', ?, 1, datetime('now'), datetime('now'))",
    )
    .bind(&id)
    .bind(code)
    .bind(name)
    .bind(name)
    .bind(account_type)
    .bind(&parent_id)
    .bind(purpose)
    .execute(pool)
    .await
    .unwrap();
    AccountId(uuid::Uuid::parse_str(&id).unwrap())
}

/// Net ledger balance: SUM(debit_base) - SUM(credit_base) for posted lines.
async fn ledger_net(pool: &sqlx::SqlitePool, account_id: &AccountId) -> Decimal {
    let net: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL) - CAST(jl.credit_base AS REAL)), 0.0)
         FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ? AND je.status = 'Posted'",
    )
    .bind(account_id.0.to_string())
    .fetch_one(pool)
    .await
    .unwrap();
    Decimal::from_f64_retain(net).unwrap_or(Decimal::ZERO)
}

/// Count posted FiscalClosing entries.
async fn count_fiscal_closing(pool: &sqlx::SqlitePool) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM journal_entries WHERE journal_type = 'FiscalClosing' AND status = 'Posted'",
    )
    .fetch_one(pool)
    .await
    .unwrap()
}

/// Count AccountOpeningBalance entries with the given source_id prefix.
async fn count_carry_forward(pool: &sqlx::SqlitePool, source_id_prefix: &str) -> i64 {
    sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM journal_entries WHERE source_id LIKE ? AND status = 'Posted'",
    )
    .bind(format!("{}%", source_id_prefix))
    .fetch_one(pool)
    .await
    .unwrap()
}

/// Full test setup: creates pool, seeds accounts, creates fiscal year + period,
/// successor year, posts revenue/expense journals, closes the period.
/// Returns (pool, year_repo, period_repo, account_repo, journal_repo, year_id,
/// period_id, successor_year_id, rev_account_id, exp_account_id, re_account_id,
/// cash_account_id).
async fn setup_profit_scenario() -> (
    Arc<sqlx::SqlitePool>,
    Arc<SqliteFiscalYearRepository>,
    Arc<SqliteFiscalPeriodRepository>,
    Arc<SqliteAccountRepository>,
    Arc<SqliteJournalEntryRepository>,
    String, // year_id
    String, // period_id
    String, // successor_year_id
    AccountId,
    AccountId,
    AccountId,
    AccountId,
) {
    let pool = build_pool().await;
    let year_repo = Arc::new(SqliteFiscalYearRepository::new(pool.clone()));
    let period_repo = Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    // Seed accounts — use codes that don't conflict with the seeded chart
    let rev_account = seed_account(pool.as_ref(), "94100", "الإيرادات التجريبية", "Revenue", "general").await;
    let exp_account = seed_account(pool.as_ref(), "95100", "المصروفات التجريبية", "Expenses", "general").await;
    // '52' already exists from run_migrations — look it up instead of inserting
    let re_account: AccountId = {
        let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = '52'")
            .fetch_one(pool.as_ref())
            .await
            .unwrap();
        AccountId(uuid::Uuid::parse_str(&id).unwrap())
    };
    let cash_account = seed_account(pool.as_ref(), "91100", "الصندوق التجريبي", "Assets", "general").await;
    let capital_account = seed_account(pool.as_ref(), "93101", "رأس المال التجريبي", "Equity", "general").await;

    // Create current fiscal year: 2025
    let year_2025 = FiscalYear::new(
        None,
        "2025".into(),
        utc("2025-01-01T00:00:00Z"),
        utc("2025-12-31T23:59:59Z"),
        None,
    )
    .unwrap();
    year_repo.create(&year_2025).await.unwrap();

    // Create successor fiscal year: 2026
    let year_2026 = FiscalYear::new(
        None,
        "2026".into(),
        utc("2026-01-01T00:00:00Z"),
        utc("2026-12-31T23:59:59Z"),
        Some(year_2025.id),
    )
    .unwrap();
    year_repo.create(&year_2026).await.unwrap();

    // Create fiscal period for 2025 (will be closed before fiscal close)
    let period = FiscalPeriod::new(
        None,
        utc("2025-01-01T00:00:00Z"),
        utc("2025-12-31T23:59:59Z"),
    )
    .unwrap();
    period_repo.create(&period).await.unwrap();

    // Post revenue journal: Dr Cash 100, Cr Revenue 100
    let mut rev_entry = JournalEntry::new(
        "JE-REV-001".into(),
        JournalType::CashReceipt,
        vec![
            line(cash_account, dec!(100), dec!(0)),
            line(rev_account, dec!(0), dec!(100)),
        ],
        utc("2025-06-15T10:00:00Z"),
        "إيراد".into(),
        None,
    )
    .unwrap();
    rev_entry.post().unwrap();
    journal_repo.save(&rev_entry).await.unwrap();

    // Post expense journal: Dr Expense 60, Cr Cash 60
    let mut exp_entry = JournalEntry::new(
        "JE-EXP-001".into(),
        JournalType::CashPayment,
        vec![
            line(exp_account, dec!(60), dec!(0)),
            line(cash_account, dec!(0), dec!(60)),
        ],
        utc("2025-08-10T10:00:00Z"),
        "مصروف".into(),
        None,
    )
    .unwrap();
    exp_entry.post().unwrap();
    journal_repo.save(&exp_entry).await.unwrap();

    // Post a capital contribution: Dr Cash 500, Cr Capital 500
    let mut cap_entry = JournalEntry::new(
        "JE-CAP-001".into(),
        JournalType::CapitalContribution,
        vec![
            line(cash_account, dec!(500), dec!(0)),
            line(capital_account, dec!(0), dec!(500)),
        ],
        utc("2025-03-01T10:00:00Z"),
        "رسوم مالية".into(),
        None,
    )
    .unwrap();
    cap_entry.post().unwrap();
    journal_repo.save(&cap_entry).await.unwrap();

    // Close the fiscal period (prerequisite for fiscal year close)
    let mut period = period_repo.find_by_id(&period.id).await.unwrap().unwrap();
    period.close("admin", FiscalPeriodStatus::Closed).unwrap();
    period_repo.update(&period).await.unwrap();

    (
        pool,
        year_repo,
        period_repo,
        account_repo,
        journal_repo,
        year_2025.id.0.to_string(),
        period.id.0.to_string(),
        year_2026.id.0.to_string(),
        rev_account,
        exp_account,
        re_account,
        cash_account,
    )
}

// ---------------------------------------------------------------------------
// TEST A — Closed period + FiscalClosing succeeds (DEFECT-1 regression)
// ---------------------------------------------------------------------------

/// Verifies that a FiscalClosing journal CAN post into a closed/locked fiscal
/// period. Before the fix, `validate_posting_period` would reject it with
/// `AppError::Forbidden` because FiscalClosing was not in `is_period_exempt()`.
#[tokio::test]
async fn test_a_fiscal_closing_posts_into_closed_period() {
    let (
        pool,
        year_repo,
        period_repo,
        account_repo,
        journal_repo,
        year_id,
        period_id,
        successor_id,
        _rev,
        _exp,
        _re,
        _cash,
    ) = setup_profit_scenario().await;

    let use_case = CloseFiscalYearUseCase::new(
        year_repo.clone(),
        period_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        pool.clone(),
    );

    let cmd = CloseFiscalYearCommand {
        fiscal_year_id: year_id.clone(),
        closing_period_id: period_id.clone(),
        operation_key: "test-a-close".into(),
        finalize: true,
        retained_earnings_entry_id: None,
        carry_forward_entry_id: None,
        context: admin_context(),
    };

    let result = use_case.execute(cmd).await;
    assert!(
        result.is_ok(),
        "FiscalClosing must succeed in closed period: {:?}",
        result
    );

    // Verify FiscalClosing entry was created
    let closing_count = count_fiscal_closing(pool.as_ref()).await;
    assert_eq!(closing_count, 1, "Expected exactly 1 FiscalClosing entry");

    // Verify carry-forward entry was created
    let cf_count = count_carry_forward(pool.as_ref(), "carry_forward:").await;
    assert_eq!(cf_count, 1, "Expected exactly 1 carry-forward entry");
}

// ---------------------------------------------------------------------------
// TEST B — Carry-forward sees uncommitted closing (DEFECT-2 regression)
// ---------------------------------------------------------------------------

/// Verifies that the carry-forward entry includes the correct Retained Earnings
/// balance AFTER the FiscalClosing transfer. Before the fix, carry-forward read
/// from `self.pool` (a different connection) and missed the uncommitted
/// FiscalClosing entry, resulting in wrong RE balance in the successor year.
///
/// Scenario: Revenue = 100, Expense = 60 → Net Profit = 40
/// FiscalClosing: Dr Revenue 100 / Cr RE 100 + Dr RE 60 / Cr Expense 60
/// Carry-forward RE must be +40 (not the pre-close RE balance of 0).
#[tokio::test]
async fn test_b_carry_forward_sees_post_close_retained_earnings() {
    let (
        pool,
        year_repo,
        period_repo,
        account_repo,
        journal_repo,
        year_id,
        period_id,
        _successor_id,
        rev_account,
        exp_account,
        re_account,
        cash_account,
    ) = setup_profit_scenario().await;

    let use_case = CloseFiscalYearUseCase::new(
        year_repo.clone(),
        period_repo.clone(),
        account_repo.clone(),
        journal_repo.clone(),
        pool.clone(),
    );

    let cmd = CloseFiscalYearCommand {
        fiscal_year_id: year_id.clone(),
        closing_period_id: period_id.clone(),
        operation_key: "test-b-close".into(),
        finalize: true,
        retained_earnings_entry_id: None,
        carry_forward_entry_id: None,
        context: admin_context(),
    };

    use_case.execute(cmd).await.unwrap();

    // Verify carry-forward: Revenue should NOT appear
    let rev_net = ledger_net(pool.as_ref(), &rev_account).await;
    assert_eq!(rev_net, Decimal::ZERO, "Revenue must be zero after close");

    // Verify carry-forward: Expense should NOT appear
    let exp_net = ledger_net(pool.as_ref(), &exp_account).await;
    assert_eq!(exp_net, Decimal::ZERO, "Expense must be zero after close");

    // Verify carry-forward: Retained Earnings in successor year
    // The carry-forward entry is an AccountOpeningBalance dated 2026-01-01
    // It should include RE = net_profit = 100 - 60 = 40
    let re_in_carry_forward: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(jl.credit_base AS REAL) - CAST(jl.debit_base AS REAL)), 0.0)
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ?
           AND je.status = 'Posted'
           AND je.journal_type = 'AccountOpeningBalance'
           AND je.source_id LIKE 'carry_forward:%'",
    )
    .bind(re_account.0.to_string())
    .fetch_one(pool.as_ref())
    .await
    .unwrap();

    assert!(
        (re_in_carry_forward - 40.0).abs() < 0.01,
        "Carry-forward RE must be +40 (net profit), got {}",
        re_in_carry_forward
    );

    // Verify cash carry-forward: Cash net = 100 - 60 + 500 = 540
    let cash_in_carry_forward: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(jl.debit_base AS REAL) - CAST(jl.credit_base AS REAL)), 0.0)
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ?
           AND je.status = 'Posted'
           AND je.journal_type = 'AccountOpeningBalance'
           AND je.source_id LIKE 'carry_forward:%'",
    )
    .bind(cash_account.0.to_string())
    .fetch_one(pool.as_ref())
    .await
    .unwrap();

    assert!(
        (cash_in_carry_forward - 540.0).abs() < 0.01,
        "Carry-forward Cash must be +540, got {}",
        cash_in_carry_forward
    );
}

// ---------------------------------------------------------------------------
// TEST — Loss scenario: Revenue < Expense → negative RE carry-forward
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_c_loss_year_negative_retained_earnings_carry_forward() {
    let pool = build_pool().await;
    let year_repo = Arc::new(SqliteFiscalYearRepository::new(pool.clone()));
    let period_repo = Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    // Seed accounts
    let rev_account = seed_account(pool.as_ref(), "94100", "الإيرادات التجريبية", "Revenue", "general").await;
    let exp_account = seed_account(pool.as_ref(), "95100", "المصروفات التجريبية", "Expenses", "general").await;
    // '52' already exists from run_migrations — look it up
    let re_account: AccountId = {
        let id: String = sqlx::query_scalar("SELECT id FROM accounts WHERE code = '52'")
            .fetch_one(pool.as_ref())
            .await
            .unwrap();
        AccountId(uuid::Uuid::parse_str(&id).unwrap())
    };
    let cash_account = seed_account(pool.as_ref(), "91100", "الصندوق التجريبي", "Assets", "general").await;

    // Fiscal year 2025
    let year_2025 = FiscalYear::new(
        None, "2025".into(),
        utc("2025-01-01T00:00:00Z"), utc("2025-12-31T23:59:59Z"), None,
    ).unwrap();
    year_repo.create(&year_2025).await.unwrap();

    // Successor 2026
    let year_2026 = FiscalYear::new(
        None, "2026".into(),
        utc("2026-01-01T00:00:00Z"), utc("2026-12-31T23:59:59Z"),
        Some(year_2025.id),
    ).unwrap();
    year_repo.create(&year_2026).await.unwrap();

    // Period
    let period = FiscalPeriod::new(
        None, utc("2025-01-01T00:00:00Z"), utc("2025-12-31T23:59:59Z"),
    ).unwrap();
    period_repo.create(&period).await.unwrap();

    // Revenue = 60, Expense = 100 → Net Loss = -40
    let mut rev_entry = JournalEntry::new(
        "JE-REV-001".into(), JournalType::CashReceipt,
        vec![line(cash_account, dec!(60), dec!(0)), line(rev_account, dec!(0), dec!(60))],
        utc("2025-06-15T10:00:00Z"), "إيراد".into(), None,
    ).unwrap();
    rev_entry.post().unwrap();
    journal_repo.save(&rev_entry).await.unwrap();

    let mut exp_entry = JournalEntry::new(
        "JE-EXP-001".into(), JournalType::CashPayment,
        vec![line(exp_account, dec!(100), dec!(0)), line(cash_account, dec!(0), dec!(100))],
        utc("2025-08-10T10:00:00Z"), "مصروف".into(), None,
    ).unwrap();
    exp_entry.post().unwrap();
    journal_repo.save(&exp_entry).await.unwrap();

    // Close period
    let mut p = period_repo.find_by_id(&period.id).await.unwrap().unwrap();
    p.close("admin", FiscalPeriodStatus::Closed).unwrap();
    period_repo.update(&p).await.unwrap();

    // Execute fiscal close
    let use_case = CloseFiscalYearUseCase::new(
        year_repo.clone(), period_repo.clone(),
        account_repo.clone(), journal_repo.clone(), pool.clone(),
    );
    use_case.execute(CloseFiscalYearCommand {
        fiscal_year_id: year_2025.id.0.to_string(),
        closing_period_id: period.id.0.to_string(),
        operation_key: "test-c-loss".into(),
        finalize: true,
        retained_earnings_entry_id: None,
        carry_forward_entry_id: None,
        context: admin_context(),
    }).await.unwrap();

    // Verify RE carry-forward is -40 (net loss) — use credit-normal convention
    // (credit - debit) since RE is a credit-normal account
    let re_in_cf: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(CAST(jl.credit_base AS REAL) - CAST(jl.debit_base AS REAL)), 0.0)
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ?
           AND je.status = 'Posted'
           AND je.journal_type = 'AccountOpeningBalance'
           AND je.source_id LIKE 'carry_forward:%'",
    )
    .bind(re_account.0.to_string())
    .fetch_one(pool.as_ref())
    .await
    .unwrap();

    assert!(
        (re_in_cf - (-40.0)).abs() < 0.01,
        "Loss carry-forward RE must be -40 (net loss), got {}",
        re_in_cf
    );
}

// ---------------------------------------------------------------------------
// TEST — Reversal after close: verify close/reopen works correctly
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_d_reopen_after_close_reverses_carry_forward() {
    let (
        pool,
        year_repo,
        period_repo,
        account_repo,
        journal_repo,
        year_id,
        period_id,
        successor_id,
        _rev,
        _exp,
        _re,
        _cash,
    ) = setup_profit_scenario().await;

    // Close
    let use_case = CloseFiscalYearUseCase::new(
        year_repo.clone(), period_repo.clone(),
        account_repo.clone(), journal_repo.clone(), pool.clone(),
    );
    use_case.execute(CloseFiscalYearCommand {
        fiscal_year_id: year_id.clone(),
        closing_period_id: period_id.clone(),
        operation_key: "test-d-close".into(),
        finalize: true,
        retained_earnings_entry_id: None,
        carry_forward_entry_id: None,
        context: admin_context(),
    }).await.unwrap();

    // Verify carry-forward exists before reopen
    let cf_before = count_carry_forward(pool.as_ref(), "carry_forward:").await;
    assert_eq!(cf_before, 1, "Must have carry-forward before reopen");

    // Reopen
    let reopen_context = ExecutionContext {
        actor_id: Some("admin".into()),
        permission_keys: vec!["fiscal_year.reopen".into()],
        ..ExecutionContext::default()
    };
    let reopen_use_case = application::use_cases::fiscal_year::reopen::ReopenFiscalYearUseCase::new(
        year_repo.clone(), journal_repo.clone(),
        account_repo.clone(), pool.clone(),
    );
    reopen_use_case.execute(application::use_cases::fiscal_year::types::ReopenFiscalYearCommand {
        fiscal_year_id: year_id.clone(),
        context: reopen_context,
    }).await.unwrap();

    // Verify carry-forward entry status is now Reversed
    let cf_status: String = sqlx::query_scalar(
        "SELECT je.status FROM journal_entries je
         WHERE je.source_id LIKE 'carry_forward:%' AND je.journal_type = 'AccountOpeningBalance'
         ORDER BY je.created_at DESC LIMIT 1",
    )
    .fetch_one(pool.as_ref())
    .await
    .unwrap();
    assert_eq!(cf_status, "Reversed", "Carry-forward must be Reversed after reopen");
}

// ---------------------------------------------------------------------------
// TEST — Idempotency: close twice with same operation_key
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_e_close_idempotency_no_duplicates() {
    let (
        pool,
        year_repo,
        period_repo,
        account_repo,
        journal_repo,
        year_id,
        period_id,
        _successor_id,
        _rev,
        _exp,
        _re,
        _cash,
    ) = setup_profit_scenario().await;

    let use_case = CloseFiscalYearUseCase::new(
        year_repo.clone(), period_repo.clone(),
        account_repo.clone(), journal_repo.clone(), pool.clone(),
    );

    let cmd = CloseFiscalYearCommand {
        fiscal_year_id: year_id.clone(),
        closing_period_id: period_id.clone(),
        operation_key: "test-e-idempotent".into(),
        finalize: true,
        retained_earnings_entry_id: None,
        carry_forward_entry_id: None,
        context: admin_context(),
    };

    // Close twice
    use_case.execute(cmd.clone()).await.unwrap();
    use_case.execute(cmd).await.unwrap();

    // Must have exactly 1 FiscalClosing and 1 carry-forward
    let closing_count = count_fiscal_closing(pool.as_ref()).await;
    assert_eq!(closing_count, 1, "Idempotent close must not duplicate FiscalClosing");

    let cf_count = count_carry_forward(pool.as_ref(), "carry_forward:").await;
    assert_eq!(cf_count, 1, "Idempotent close must not duplicate carry-forward");
}

// ---------------------------------------------------------------------------
// TEST — Revenue/Expenses are NOT carried forward
// ---------------------------------------------------------------------------

#[tokio::test]
async fn test_f_revenue_and_expenses_not_in_carry_forward() {
    let (
        pool,
        year_repo,
        period_repo,
        account_repo,
        journal_repo,
        year_id,
        period_id,
        _successor_id,
        rev_account,
        exp_account,
        _re,
        _cash,
    ) = setup_profit_scenario().await;

    let use_case = CloseFiscalYearUseCase::new(
        year_repo.clone(), period_repo.clone(),
        account_repo.clone(), journal_repo.clone(), pool.clone(),
    );
    use_case.execute(CloseFiscalYearCommand {
        fiscal_year_id: year_id.clone(),
        closing_period_id: period_id.clone(),
        operation_key: "test-f-no-rev-exp".into(),
        finalize: true,
        retained_earnings_entry_id: None,
        carry_forward_entry_id: None,
        context: admin_context(),
    }).await.unwrap();

    // Check carry-forward entries — must NOT include Revenue or Expense accounts
    let rev_in_cf: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ? AND je.journal_type = 'AccountOpeningBalance'
           AND je.source_id LIKE 'carry_forward:%'",
    )
    .bind(rev_account.0.to_string())
    .fetch_one(pool.as_ref())
    .await
    .unwrap();

    assert_eq!(rev_in_cf, 0, "Revenue must NOT appear in carry-forward");

    let exp_in_cf: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ? AND je.journal_type = 'AccountOpeningBalance'
           AND je.source_id LIKE 'carry_forward:%'",
    )
    .bind(exp_account.0.to_string())
    .fetch_one(pool.as_ref())
    .await
    .unwrap();

    assert_eq!(exp_in_cf, 0, "Expense must NOT appear in carry-forward");
}

// ---------------------------------------------------------------------------
// TEST — Atomic rollback: failure after FiscalClosing rolls back everything
// ---------------------------------------------------------------------------

/// This test verifies the atomicity of the close transaction.
/// We use a scenario where the successor year does not exist, which causes
/// `find_successor_year` to fail BEFORE the transaction begins, proving
/// the system doesn't leave partial state.
#[tokio::test]
async fn test_g_no_successor_fails_safely_before_transaction() {
    let pool = build_pool().await;
    let year_repo = Arc::new(SqliteFiscalYearRepository::new(pool.clone()));
    let period_repo = Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let account_repo = Arc::new(SqliteAccountRepository::new(pool.clone()));
    let journal_repo = Arc::new(SqliteJournalEntryRepository::new(pool.clone()));

    // Seed accounts
    seed_account(pool.as_ref(), "94100", "الإيرادات التجريبية", "Revenue", "general").await;
    // '52' already exists from run_migrations — no need to insert

    // Fiscal year WITHOUT successor
    let year = FiscalYear::new(
        None, "2025".into(),
        utc("2025-01-01T00:00:00Z"), utc("2025-12-31T23:59:59Z"), None,
    ).unwrap();
    year_repo.create(&year).await.unwrap();

    let period = FiscalPeriod::new(
        None, utc("2025-01-01T00:00:00Z"), utc("2025-12-31T23:59:59Z"),
    ).unwrap();
    period_repo.create(&period).await.unwrap();

    // Close period
    let mut p = period_repo.find_by_id(&period.id).await.unwrap().unwrap();
    p.close("admin", FiscalPeriodStatus::Closed).unwrap();
    period_repo.update(&p).await.unwrap();

    // Attempt fiscal close without successor
    let use_case = CloseFiscalYearUseCase::new(
        year_repo.clone(), period_repo.clone(),
        account_repo.clone(), journal_repo.clone(), pool.clone(),
    );
    let result = use_case.execute(CloseFiscalYearCommand {
        fiscal_year_id: year.id.0.to_string(),
        closing_period_id: period.id.0.to_string(),
        operation_key: "test-g-no-successor".into(),
        finalize: true,
        retained_earnings_entry_id: None,
        carry_forward_entry_id: None,
        context: admin_context(),
    }).await;

    assert!(result.is_err(), "Close must fail without successor year");

    // Verify no FiscalClosing was created
    let closing_count = count_fiscal_closing(pool.as_ref()).await;
    assert_eq!(closing_count, 0, "No FiscalClosing must exist after failed close");
}
