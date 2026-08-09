use std::str::FromStr;
use std::sync::Arc;

use application::ports::fiscal_period_repository::FiscalPeriodRepository;
use chrono::{DateTime, Duration, Utc};
use domain::accounting::fiscal_period::{FiscalPeriod, FiscalPeriodStatus};
use domain::shared::ids::FiscalPeriodId;
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::SqliteFiscalPeriodRepository;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_fiscal_period_test_{}.sqlite", uuid::Uuid::new_v4()));
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

fn period(start: DateTime<Utc>, end: DateTime<Utc>) -> FiscalPeriod {
    FiscalPeriod::new(None, start, end).unwrap()
}

#[tokio::test]
async fn create_find_list_round_trip() {
    let pool = build_pool().await;
    let repo = SqliteFiscalPeriodRepository::new(pool);

    let start = Utc::now() - Duration::days(30);
    let end = Utc::now() + Duration::days(30);
    let p = period(start, end);
    repo.create(&p).await.unwrap();

    let fetched = repo.find_by_id(&p.id).await.unwrap().unwrap();
    assert_eq!(fetched.id, p.id);
    assert_eq!(fetched.status, FiscalPeriodStatus::Open);
    assert_eq!(fetched.start_date.to_rfc3339(), start.to_rfc3339());
    assert_eq!(fetched.end_date.to_rfc3339(), end.to_rfc3339());
    assert!(fetched.closed_at.is_none());

    let all = repo.list().await.unwrap();
    assert_eq!(all.len(), 1);
}

#[tokio::test]
async fn find_by_date_matches_only_containing_periods() {
    let pool = build_pool().await;
    let repo = SqliteFiscalPeriodRepository::new(pool);

    // 2026-01-01 .. 2026-03-31
    let jan = utils_utc("2026-01-01T00:00:00Z");
    let mar = utils_utc("2026-03-31T23:59:59Z");
    repo.create(&period(jan, mar)).await.unwrap();

    // inside -> found
    let inside = utils_utc("2026-02-15T00:00:00Z");
    assert_eq!(repo.find_by_date(inside).await.unwrap().len(), 1);

    // outside bounds -> not found
    let outside = utils_utc("2026-04-01T00:00:00Z");
    assert_eq!(repo.find_by_date(outside).await.unwrap().len(), 0);

    // inclusive end-of-window
    assert_eq!(repo.find_by_date(mar).await.unwrap().len(), 1);
}

#[tokio::test]
async fn update_persists_close_metadata() {
    let pool = build_pool().await;
    let repo = SqliteFiscalPeriodRepository::new(pool);

    let mut p = period(
        Utc::now() - Duration::days(30),
        Utc::now() + Duration::days(30),
    );
    repo.create(&p).await.unwrap();

    p.close("admin", FiscalPeriodStatus::Closed).unwrap();
    repo.update(&p).await.unwrap();

    let fetched = repo.find_by_id(&p.id).await.unwrap().unwrap();
    assert_eq!(fetched.status, FiscalPeriodStatus::Closed);
    assert_eq!(fetched.closed_by.as_deref(), Some("admin"));
    assert!(fetched.closed_at.is_some());
}

#[tokio::test]
async fn reopen_after_close_persists() {
    let pool = build_pool().await;
    let repo = SqliteFiscalPeriodRepository::new(pool);

    let mut p = period(
        Utc::now() - Duration::days(30),
        Utc::now() + Duration::days(30),
    );
    repo.create(&p).await.unwrap();

    p.close("admin", FiscalPeriodStatus::Closed).unwrap();
    repo.update(&p).await.unwrap();
    p.reopen().unwrap();
    repo.update(&p).await.unwrap();

    let fetched = repo.find_by_id(&p.id).await.unwrap().unwrap();
    assert_eq!(fetched.status, FiscalPeriodStatus::Reopened);
    assert!(fetched.closed_at.is_none());
}

#[tokio::test]
async fn unknown_id_returns_none() {
    let pool = build_pool().await;
    let repo = SqliteFiscalPeriodRepository::new(pool);
    assert!(repo.find_by_id(&FiscalPeriodId::new()).await.unwrap().is_none());
}

fn utils_utc(rfc3339: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(rfc3339).unwrap().with_timezone(&Utc)
}