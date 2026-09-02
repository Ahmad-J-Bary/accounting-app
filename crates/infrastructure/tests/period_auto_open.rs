//! Auto-open roll-forward of fiscal periods at posting time.
//!
//! When periods are already in use and a posted entry's date lands AFTER every
//! existing period (e.g. recording today's payment after the last manual period
//! ended), the posting guard must open a fresh `Open` period covering the entry
//! date instead of failing. Backdated entries (before the earliest period) keep
//! failing — deliberately opening a past window stays a manual act.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use chrono::{DateTime, Utc};
use domain::accounting::fiscal_period::FiscalPeriodStatus;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{SqliteFiscalPeriodRepository, SqliteJournalEntryRepository};
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_period_auto_open_{}.sqlite",
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
    let pool: Arc<sqlx::SqlitePool> = Arc::new(pool);
    run_migrations(&pool).await.unwrap();
    pool
}

fn test_currency() -> Currency {
    Currency::new("BASE", "عملة أساسية", "Base Currency", "B", 2, true)
}

fn utc(rfc3339: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(rfc3339)
        .unwrap()
        .with_timezone(&Utc)
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

/// Posts a balanced operational journal dated `date`; returns the repository
/// result (Ok when the guard accepted, Err(AppError::Forbidden) when rejected).
async fn post_dated(
    journal_repo: &SqliteJournalEntryRepository,
    pool: &Arc<sqlx::SqlitePool>,
    date: DateTime<Utc>,
) -> Result<(), AppError> {
    let (acc_a, acc_b) = real_accounts(pool).await;
    let c = test_currency();
    let mut entry = JournalEntry::new(
        format!("JE-{}", uuid::Uuid::new_v4()),
        JournalType::CashReceipt,
        vec![
            JournalLine::new(
                acc_a,
                MonetaryAmount::new(Money::new(dec!(100), c.clone()), dec!(1)),
                MonetaryAmount::zero(c.clone()),
                "مدين".to_string(),
            ),
            JournalLine::new(
                acc_b,
                MonetaryAmount::zero(c.clone()),
                MonetaryAmount::new(Money::new(dec!(100), c), dec!(1)),
                "دائن".to_string(),
            ),
        ],
        date,
        "قيد ترحيل".to_string(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    journal_repo.save(&entry).await
}

/// The reported regression: a 2025-only calendar, then recording a payment on
/// 2026-08-30 must succeed by auto-opening a covering Open period — the payment
/// / settle / daily-entry path must never dead-end in "لا توجد فترة مالية".
#[tokio::test]
async fn posting_after_last_period_auto_opens_covering_period() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    let mut period_2025 = domain::accounting::fiscal_period::FiscalPeriod::new(
        None,
        utc("2025-01-01T00:00:00Z"),
        utc("2025-12-31T23:59:59Z"),
    )
    .unwrap();
    period_repo.create(&period_2025).await.unwrap();
    period_2025.lock("admin").unwrap();
    period_repo.update(&period_2025).await.unwrap();

    // Recording a payment dated inside 2026 (after every period) succeeds and
    // auto-opens a fresh Open period that covers the entry date.
    let res = post_dated(&journal_repo, &pool, utc("2026-08-30T10:00:00Z")).await;
    assert!(
        res.is_ok(),
        "posting after the last period must auto-open: {:?}",
        res
    );

    let periods = period_repo.list().await.unwrap();
    let opened = periods
        .iter()
        .find(|p| p.status.can_post() && p.contains(utc("2026-08-30T10:00:00Z")));
    assert!(
        opened.is_some(),
        "an Open period covering the entry date must exist"
    );
    let opened = opened.unwrap();
    assert_eq!(opened.status, FiscalPeriodStatus::Open);
    assert!(
        opened.start_date > utc("2025-12-31T23:59:59Z"),
        "must not overlap the 2025 period"
    );

    // The rolled-forward period is reused: a second posting in 2026 keeps
    // working WITHOUT creating a duplicate period.
    let res2 = post_dated(&journal_repo, &pool, utc("2026-10-01T09:00:00Z")).await;
    assert!(res2.is_ok());
    let periods_after = period_repo.list().await.unwrap();
    let covering_count = periods_after
        .iter()
        .filter(|p| p.contains(utc("2026-10-01T09:00:00Z")) && p.status.can_post())
        .count();
    assert_eq!(covering_count, 1, "the same covering period must be reused");
}

/// A differently-windowed period set: latest period ends mid-2026, a move in
/// late 2026 rolls forward from that end — never overlapping existing windows.
#[tokio::test]
async fn rolls_forward_from_latest_period_without_overlap() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    period_repo
        .create(
            &domain::accounting::fiscal_period::FiscalPeriod::new(
                None,
                utc("2026-01-01T00:00:00Z"),
                utc("2026-03-31T23:59:59Z"),
            )
            .unwrap(),
        )
        .await
        .unwrap();

    let res = post_dated(&journal_repo, &pool, utc("2026-08-30T10:00:00Z")).await;
    assert!(
        res.is_ok(),
        "must roll forward after mid-year period end: {:?}",
        res
    );

    let periods = period_repo.list().await.unwrap();
    let covering: Vec<_> = periods
        .iter()
        .filter(|p| p.contains(utc("2026-08-30T10:00:00Z")))
        .collect();
    assert_eq!(
        covering.len(),
        1,
        "exactly one period covers the entry date"
    );
    assert!(covering[0].status.can_post());
    assert!(
        covering[0].start_date > utc("2026-03-31T23:59:59Z"),
        "new period starts after the previous end"
    );
}

/// Backdated entries stay blocked: auto-open only ever moves forward, and past
/// windows are opened by explicit accountant action.
#[tokio::test]
async fn backdated_entry_before_earliest_period_still_rejected() {
    let pool = build_pool().await;
    let period_repo = SqliteFiscalPeriodRepository::new(pool.clone());
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    period_repo
        .create(
            &domain::accounting::fiscal_period::FiscalPeriod::new(
                None,
                utc("2026-01-01T00:00:00Z"),
                utc("2026-12-31T23:59:59Z"),
            )
            .unwrap(),
        )
        .await
        .unwrap();

    let res = post_dated(&journal_repo, &pool, utc("2025-11-30T08:00:00Z")).await;
    assert!(
        matches!(res, Err(AppError::Forbidden(_))),
        "backdated entry must stay blocked: {:?}",
        res
    );
    assert_eq!(
        period_repo.list().await.unwrap().len(),
        1,
        "no period may be auto-created for past dates"
    );
}
