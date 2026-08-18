//! Financial Period lifecycle through the REAL use cases. Create,
//! close, reopen and lock a fiscal period end-to-end, and verify that the
//! posting guard reacts to each status (closed rejects, reopened accepts, locked
//! rejects and cannot be reopened) — all driven by the use cases, not by
//! mutating the domain object directly.
//!
//! Covered here:
//!   - CreateFiscalPeriodUseCase creates an Open period;
//!   - CloseFiscalPeriodUseCase (finalize) closes it and a journal inside the
//!     closed window is rejected;
//!   - ReopenFiscalPeriodUseCase reopens it and posting is accepted again;
//!   - LockFiscalPeriodUseCase locks it, posting is rejected, and reopening a
//!     locked period fails with a domain error.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use application::ports::journal_entry_repository::JournalEntryRepository;
use application::use_cases::fiscal_period::{
    CloseFiscalPeriodCommand, CloseFiscalPeriodUseCase, CreateFiscalPeriodCommand,
    CreateFiscalPeriodUseCase, LockFiscalPeriodCommand, LockFiscalPeriodUseCase,
    ReopenFiscalPeriodCommand, ReopenFiscalPeriodUseCase,
};
use chrono::{DateTime, Utc};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::money::Money;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::AccountId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{SqliteFiscalPeriodRepository, SqliteJournalEntryRepository};
use rust_decimal_macros::dec;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_period_lifecycle_{}.sqlite", uuid::Uuid::new_v4()));
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
    Currency::new("S", "عملة أساسية", "Base Currency", "B", 2, true)
}

fn utc(rfc3339: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(rfc3339).unwrap().with_timezone(&Utc)
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

/// Posts a balanced journal dated inside the 2026 window, returning whether the
/// period guard accepted it.
async fn post_dated_in_2026(
    journal_repo: &SqliteJournalEntryRepository,
    pool: &Arc<sqlx::SqlitePool>,
    journal_type: JournalType,
) -> Result<(), AppError> {
    let (acc_a, acc_b) = real_accounts(pool).await;
    let c = test_currency();
    let mut entry = JournalEntry::new(
        format!("JE-{}", uuid::Uuid::new_v4()),
        journal_type,
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
        utc("2026-06-15T10:00:00Z"),
        "قيد فترة".to_string(),
        None,
    )
    .unwrap();
    entry.post().unwrap();
    journal_repo.save(&entry).await
}

// ---------------------------------------------------------------------------
// Create -> Close (rejects posting) -> Reopen (accepts again) -> Lock (rejects
// and cannot be reopened): the full use-case lifecycle.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn period_close_reopen_lock_lifecycle_via_use_cases() {
    let pool = build_pool().await;
    let period_repo: Arc<dyn FiscalPeriodRepository> =
        Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let journal_repo = SqliteJournalEntryRepository::new(pool.clone());

    // Create an Open period.
    let created = CreateFiscalPeriodUseCase::new(period_repo.clone())
        .execute(CreateFiscalPeriodCommand {
            company_id: None,
            start_date: "2026-01-01T00:00:00Z".to_string(),
            end_date: "2026-12-31T23:59:59Z".to_string(),
        })
        .await
        .expect("create period");
    assert_eq!(created.status, "Open", "a new period is born Open");

    // Open period accepts posting inside its window.
    assert!(post_dated_in_2026(&journal_repo, &pool, JournalType::CashReceipt).await.is_ok());

    // Close it via the use case (finalize immediately to Closed).
    let closed = CloseFiscalPeriodUseCase::new(period_repo.clone())
        .execute(CloseFiscalPeriodCommand {
            period_id: created.id.clone(),
            closed_by: "admin".into(),
            finalize: true,
        })
        .await
        .expect("close period");
    assert_eq!(closed.status, "Closed");
    assert_eq!(closed.closed_by.as_deref(), Some("admin"));

    // A posting dated inside the closed window is rejected.
    let err = post_dated_in_2026(&journal_repo, &pool, JournalType::CashReceipt).await;
    assert!(matches!(err, Err(AppError::Forbidden(_))), "closed period must reject posting: {err:?}");

    // Reopen via the use case: status Reopened, posting accepted again.
    let reopened = ReopenFiscalPeriodUseCase::new(period_repo.clone())
        .execute(ReopenFiscalPeriodCommand { period_id: created.id.clone() })
        .await
        .expect("reopen period");
    assert_eq!(reopened.status, "Reopened");
    assert!(post_dated_in_2026(&journal_repo, &pool, JournalType::CashReceipt).await.is_ok());

    // Lock via the use case: status Locked, posting rejected.
    let locked = LockFiscalPeriodUseCase::new(period_repo.clone())
        .execute(LockFiscalPeriodCommand { period_id: created.id.clone(), locked_by: "admin".into() })
        .await
        .expect("lock period");
    assert_eq!(locked.status, "Locked");
    assert_eq!(locked.locked_by.as_deref(), Some("admin"));

    let err = post_dated_in_2026(&journal_repo, &pool, JournalType::CashReceipt).await;
    assert!(matches!(err, Err(AppError::Forbidden(_))), "locked period must reject posting: {err:?}");

    // A Locked period cannot be reopened.
    let reopen_err = ReopenFiscalPeriodUseCase::new(period_repo.clone())
        .execute(ReopenFiscalPeriodCommand { period_id: created.id })
        .await
        .unwrap_err();
    assert!(matches!(reopen_err, AppError::Domain(_)), "locked period must reject reopen: {reopen_err:?}");
}