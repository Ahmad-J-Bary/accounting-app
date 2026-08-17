use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use chrono::{DateTime, Utc};
use domain::accounting::fiscal_period::{FiscalPeriod, FiscalPeriodStatus};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::money::Money;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{SqliteFiscalPeriodRepository, SqliteJournalEntryRepository};
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

fn balanced_lines(amount: rust_decimal::Decimal, acc_a: AccountId, acc_b: AccountId) -> Vec<JournalLine> {
    let c = test_currency();
    vec![
        JournalLine::new(
            acc_a,
            MonetaryAmount::new(Money::new(amount, c.clone()), dec!(1)),
            MonetaryAmount::zero(c.clone()),
            "مدين".to_string(),
        ),
        JournalLine::new(
            acc_b,
            MonetaryAmount::zero(c.clone()),
            MonetaryAmount::new(Money::new(amount, c), dec!(1)),
            "دائن".to_string(),
        ),
    ]
}

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_fp_guard_{}.sqlite", uuid::Uuid::new_v4()));
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

async fn real_accounts(pool: &sqlx::SqlitePool) -> (AccountId, AccountId) {
    let ids: Vec<String> = sqlx::query_scalar("SELECT id FROM accounts ORDER BY code LIMIT 2")
        .fetch_all(pool)
        .await
        .unwrap();
    (
        AccountId(uuid::Uuid::parse_str(&ids[0]).unwrap()),
        AccountId(uuid::Uuid::parse_str(&ids[1]).unwrap()),
    )
}

fn utc(rfc3339: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(rfc3339).unwrap().with_timezone(&Utc)
}

fn period_2026() -> FiscalPeriod {
    FiscalPeriod::new(
        None,
        utc("2026-01-01T00:00:00Z"),
        utc("2026-12-31T23:59:59Z"),
    )
    .unwrap()
}

/// Posts a balanced journal of the given type dated `date`, returning the
/// repository result (Ok for accepted, Err for period-rejected).
async fn post_dated(
    repo: &SqliteJournalEntryRepository,
    pool: &Arc<sqlx::SqlitePool>,
    journal_type: JournalType,
    date: DateTime<Utc>,
) -> Result<(), AppError> {
    let (acc_a, acc_b) = real_accounts(pool).await;
    let mut entry = JournalEntry::new(
        format!("JE-{}", uuid::Uuid::new_v4()),
        journal_type,
        balanced_lines(dec!(100), acc_a, acc_b),
        date,
        "قيد اختبار".to_string(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    repo.save(&entry).await
}

// ── Requirement 8 scenarios ────────────────────────────────────────────────

/// New company -> create a period -> a posted journal inside it is accepted.
#[tokio::test]
async fn new_company_period_accepts_posting_inside() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    period_repo.create(&period_2026()).await.unwrap();
    let res = post_dated(&journal_repo, &pool, JournalType::CashReceipt, utc("2026-06-15T10:00:00Z")).await;
    assert!(res.is_ok(), "posting inside an Open period must be accepted: {:?}", res);
}

/// Once periods exist, a journal dated outside every period is rejected.
#[tokio::test]
async fn journal_outside_all_periods_is_rejected_when_periods_exist() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    period_repo.create(&period_2026()).await.unwrap();
    let res = post_dated(&journal_repo, &pool, JournalType::CashReceipt, utc("2025-12-31T10:00:00Z")).await;
    assert!(matches!(res, Err(AppError::Forbidden(_))), "expected Forbidden, got {:?}", res);
}

/// A closed period rejects posting inside its window.
#[tokio::test]
async fn closed_period_rejects_transactions() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    let mut period = period_2026();
    period_repo.create(&period).await.unwrap();
    period.close("admin", FiscalPeriodStatus::Closed).unwrap();
    period_repo.update(&period).await.unwrap();

    let res = post_dated(&journal_repo, &pool, JournalType::CashReceipt, utc("2026-06-15T10:00:00Z")).await;
    assert!(matches!(res, Err(AppError::Forbidden(_))), "expected Forbidden, got {:?}", res);
}

/// A locked period rejects posting inside its window.
#[tokio::test]
async fn locked_period_rejects_transactions() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    let mut period = period_2026();
    period_repo.create(&period).await.unwrap();
    period.lock("admin").unwrap();
    period_repo.update(&period).await.unwrap();

    let res = post_dated(&journal_repo, &pool, JournalType::CashReceipt, utc("2026-06-15T10:00:00Z")).await;
    assert!(matches!(res, Err(AppError::Forbidden(_))), "expected Forbidden, got {:?}", res);
}

/// Reopening a closed period returns it to posting.
#[tokio::test]
async fn reopened_period_accepts_posting_again() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    let mut period = period_2026();
    period_repo.create(&period).await.unwrap();
    period.close("admin", FiscalPeriodStatus::Closed).unwrap();
    period_repo.update(&period).await.unwrap();
    period.reopen().unwrap();
    period_repo.update(&period).await.unwrap();

    let res = post_dated(&journal_repo, &pool, JournalType::CashReceipt, utc("2026-06-15T10:00:00Z")).await;
    assert!(res.is_ok(), "Reopened period must accept posting: {:?}", res);
}

/// A reversal contra (linked via `reversal_of_entry_id`) is allowed inside a
/// closed period, regardless of which semantic `journal_type` it inherits —
/// the exemption is relationship-based, not type-based.
#[tokio::test]
async fn reversal_in_closed_period_is_allowed() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    let mut period = period_2026();
    period_repo.create(&period).await.unwrap();

    let (acc_a, acc_b) = real_accounts(pool.as_ref()).await;
    let mut original = JournalEntry::new(
        "JE-REV-ORIG".to_string(),
        JournalType::CashReceipt,
        balanced_lines(dec!(100), acc_a, acc_b),
        utc("2026-06-15T10:00:00Z"),
        "أصل قابل للعكس".to_string(),
        None,
    )
    .unwrap();
    original.post().unwrap();
    journal_repo.save(&original).await.unwrap();

    // Lock down the period, then reverse through the atomic reversal pair.
    period.close("admin", FiscalPeriodStatus::Closed).unwrap();
    period_repo.update(&period).await.unwrap();

    // The contra inherits `CashReceipt` and carries the reversal relationship.
    let mut reversal = JournalEntry::create_reversal(
        &original,
        "JE-REV-CONTRA".to_string(),
        utc("2026-06-20T09:00:00Z"),
        "عكس في فترة مغلقة".to_string(),
    )
    .unwrap();
    assert!(reversal.reversal_of_entry_id.is_some());
    assert_eq!(reversal.journal_type, JournalType::CashReceipt);
    reversal.post().unwrap();
    original.reverse().unwrap();

    // The reversal flow persists both rows in one transaction; posting the
    // contra inside a closed period must be allowed (relationship exemption).
    let res = journal_repo.save_reversal_pair(&reversal, &original).await;
    assert!(res.is_ok(), "Reversal must bypass period gating: {:?}", res);
}

/// Opening-balance entries (Company Setup / Lifecycle) bypass period gating
/// even when the date is before the first operational period.
#[tokio::test]
async fn opening_balance_entry_bypasses_period_gating() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    period_repo.create(&period_2026()).await.unwrap();

    let res = post_dated(
        &journal_repo,
        &pool,
        JournalType::AccountOpeningBalance,
        utc("2025-11-30T00:00:00Z"),
    )
    .await;
    assert!(res.is_ok(), "opening balance must bypass period gating: {:?}", res);
}

/// No periods at all -> legacy mode, posting allowed.
#[tokio::test]
async fn no_periods_allows_legacy_posting() {
    let pool = build_pool().await;
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    let res = post_dated(&journal_repo, &pool, JournalType::CashReceipt, Utc::now()).await;
    assert!(res.is_ok(), "legacy posting with no periods must be allowed: {:?}", res);
}

/// A draft may be saved inside a closed period, but posting it is rejected:
/// the date guard fires on the Draft -> Posted transition.
#[tokio::test]
async fn draft_can_be_saved_but_not_posted_in_closed_period() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    let mut period = period_2026();
    period_repo.create(&period).await.unwrap();
    period.close("admin", FiscalPeriodStatus::Closed).unwrap();
    period_repo.update(&period).await.unwrap();

    let (acc_a, acc_b) = real_accounts(&pool).await;
    let mut entry = JournalEntry::new(
        format!("JE-{}", uuid::Uuid::new_v4()),
        JournalType::GeneralJournal,
        balanced_lines(dec!(100), acc_a, acc_b),
        utc("2026-06-15T10:00:00Z"),
        "مسودة في فترة مغلقة".to_string(),
        None,
    )
    .unwrap();

    // Saving the draft is fine (drafts are not a posted move yet).
    journal_repo.save(&entry).await.unwrap();

    // Posting it inside the closed period must now be rejected.
    entry.post().unwrap();
    let res = journal_repo.save(&entry).await;
    assert!(matches!(res, Err(AppError::Forbidden(_))), "expected Forbidden on post, got {:?}", res);
}
