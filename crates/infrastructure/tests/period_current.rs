//! Current Period resolution. A transaction dated at any point must
//! resolve to exactly the fiscal period that contains it (`find_by_date`), and
//! the CreateFiscalPeriodUseCase must reject a new period that overlaps an
//! existing one so reporting windows never double-count a date.
//!
//! Covered here through the REAL use cases and repository:
//!   - create two adjacent periods (2026 H1 / H2);
//!   - a date inside H1 resolves to H1 and only H1; a date in the gap between
//!     periods resolves to nothing; a date inside H2 resolves to H2;
//!   - an overlapping new period is rejected (Conflict) and not persisted.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use application::use_cases::fiscal_period::{CreateFiscalPeriodCommand, CreateFiscalPeriodUseCase};
use chrono::{DateTime, Utc};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteFiscalPeriodRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!(
        "acc_period_current_{}.sqlite",
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

fn utc(rfc3339: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(rfc3339)
        .unwrap()
        .with_timezone(&Utc)
}

fn cmd(start: &str, end: &str) -> CreateFiscalPeriodCommand {
    CreateFiscalPeriodCommand {
        company_id: None,
        start_date: start.to_string(),
        end_date: end.to_string(),
    }
}

// ---------------------------------------------------------------------------
// Two adjacent, non-overlapping periods resolve a transaction date to the ONE
// period that contains it (or to none in the gap).
// ---------------------------------------------------------------------------
#[tokio::test]
async fn transaction_date_resolves_to_the_containing_period_only() {
    let pool = build_pool().await;
    let repo: Arc<dyn FiscalPeriodRepository> =
        Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let uc = CreateFiscalPeriodUseCase::new(repo.clone());

    let h1 = uc
        .execute(cmd("2026-01-01T00:00:00Z", "2026-06-30T23:59:59Z"))
        .await
        .expect("create H1");
    let h2 = uc
        .execute(cmd("2026-07-01T00:00:00Z", "2026-12-31T23:59:59Z"))
        .await
        .expect("create H2");

    // Inside H1 → resolves to H1 and only H1.
    let in_h1 = repo
        .find_by_date(utc("2026-03-15T10:00:00Z"))
        .await
        .unwrap();
    assert_eq!(
        in_h1.len(),
        1,
        "a March date resolves to exactly one period"
    );
    assert_eq!(in_h1[0].id.to_string(), h1.id, "March belongs to H1");

    // Boundary inclusive: the H1 end instant still belongs to H1.
    let at_end_h1 = repo
        .find_by_date(utc("2026-06-30T23:59:59Z"))
        .await
        .unwrap();
    assert_eq!(at_end_h1.len(), 1);
    assert_eq!(at_end_h1[0].id.to_string(), h1.id);

    // The very next second is H2, not H1.
    let at_start_h2 = repo
        .find_by_date(utc("2026-07-01T00:00:00Z"))
        .await
        .unwrap();
    assert_eq!(at_start_h2.len(), 1);
    assert_eq!(at_start_h2[0].id.to_string(), h2.id);

    // Inside H2 → H2.
    let in_h2 = repo
        .find_by_date(utc("2026-10-01T12:00:00Z"))
        .await
        .unwrap();
    assert_eq!(in_h2.len(), 1);
    assert_eq!(in_h2[0].id.to_string(), h2.id);

    // A date before both periods resolves to nothing (legacy / pre-setup).
    let before = repo
        .find_by_date(utc("2025-11-30T00:00:00Z"))
        .await
        .unwrap();
    assert!(
        before.is_empty(),
        "a date before any period has no current period"
    );
}

// ---------------------------------------------------------------------------
// Creating a period that overlaps an existing one is rejected (Conflict) and is
// NOT persisted, so a transaction date can never be double-counted.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn overlapping_period_is_rejected_and_not_persisted() {
    let pool = build_pool().await;
    let repo: Arc<dyn FiscalPeriodRepository> =
        Arc::new(SqliteFiscalPeriodRepository::new(pool.clone()));
    let uc = CreateFiscalPeriodUseCase::new(repo.clone());

    uc.execute(cmd("2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z"))
        .await
        .expect("create 2026");

    // Entirely inside the 2026 window → overlap.
    let err = uc
        .execute(cmd("2026-06-01T00:00:00Z", "2026-06-30T23:59:59Z"))
        .await
        .unwrap_err();
    assert!(
        matches!(err, AppError::Conflict(_)),
        "overlap must be a Conflict, got {err:?}"
    );

    // Spanning into the existing window → overlap.
    let err2 = uc
        .execute(cmd("2026-12-01T00:00:00Z", "2027-03-31T23:59:59Z"))
        .await
        .unwrap_err();
    assert!(
        matches!(err2, AppError::Conflict(_)),
        "partial overlap must be a Conflict"
    );

    // A period strictly after the existing window is fine.
    let ok = uc
        .execute(cmd("2027-01-01T00:00:00Z", "2027-12-31T23:59:59Z"))
        .await;
    assert!(ok.is_ok(), "non-overlapping future period must be accepted");

    assert_eq!(
        repo.list().await.unwrap().len(),
        2,
        "only the two valid periods are persisted"
    );
}
