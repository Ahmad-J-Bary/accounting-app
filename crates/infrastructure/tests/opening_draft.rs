//! Resumable opening-balance wizard draft store.
//!
//! A lightweight per-app JSON scratch pad (Save → Exit → Continue Later). The
//! repository round-trips a serialized wizard state and the use cases enforce
//! the size cap + clearing.

use std::str::FromStr;
use std::sync::Arc;

use application::errors::AppError;
use application::ports::opening_draft_repository::OpeningDraftRepository;
use application::use_cases::opening_balance::{
    ClearOpeningDraftUseCase, GetOpeningDraftUseCase, SaveOpeningDraftUseCase,
};
use infrastructure::db::pool::run_migrations;
use infrastructure::repositories::{
    SqliteOpeningDraftRepository, SqliteOpeningMigrationRepository, SqliteSettingsRepository,
};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};

async fn build_pool() -> Arc<sqlx::SqlitePool> {
    let mut path = std::env::temp_dir();
    path.push(format!("acc_opening_draft_{}.sqlite", uuid::Uuid::new_v4()));
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

fn repo(pool: &Arc<sqlx::SqlitePool>) -> Arc<dyn OpeningDraftRepository> {
    Arc::new(SqliteOpeningDraftRepository::new(pool.clone()))
}

/// Save use case with the lifecycle guard wired in (real settings +
/// migration repos against the test db — defaults to an EXISTING company with
/// no Locked migration, so the workflow is open).
fn save_uc(pool: &Arc<sqlx::SqlitePool>) -> SaveOpeningDraftUseCase {
    SaveOpeningDraftUseCase::new(
        repo(pool),
        Arc::new(SqliteSettingsRepository::new(pool.clone())),
        Arc::new(SqliteOpeningMigrationRepository::new(pool.clone())),
    )
}

// ---------------------------------------------------------------------------
// Empty by default; save → get round-trips exactly; clear removes it.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn draft_round_trips_save_get_clear() {
    let pool = build_pool().await;
    let repos = repo(&pool);

    assert_eq!(
        repos.get().await.unwrap(),
        None,
        "a fresh company must have no opening draft"
    );

    let snapshot = r#"{"stepIndex":3,"items":[{"kind":"AR","amount":"1200"}]}"#.to_string();
    save_uc(&pool)
        .execute(&snapshot)
        .await
        .unwrap();
    assert_eq!(
        GetOpeningDraftUseCase::new(repos.clone()).execute().await.unwrap(),
        Some(snapshot.clone()),
        "saved draft must be returned verbatim"
    );

    // Overwriting replaces, not appends.
    save_uc(&pool)
        .execute("{\"step\":5}")
        .await
        .unwrap();
    assert_eq!(
        GetOpeningDraftUseCase::new(repos).execute().await.unwrap(),
        Some("{\"step\":5}".to_string()),
        "re-saving must replace the previous draft"
    );

    ClearOpeningDraftUseCase::new(repo(&pool)).execute().await.unwrap();
    assert_eq!(
        repo(&pool).get().await.unwrap(),
        None,
        "clear must remove the draft entirely"
    );
}

// ---------------------------------------------------------------------------
// The draft table is a single row guarded by id='default'.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn draft_store_uses_single_row() {
    let pool = build_pool().await;
    save_uc(&pool)
        .execute(r#"{"once":true}"#)
        .await
        .unwrap();
    save_uc(&pool)
        .execute(r#"{"twice":true}"#)
        .await
        .unwrap();

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM opening_wizard_draft")
        .fetch_one(pool.as_ref())
        .await
        .unwrap();
    assert_eq!(count, 1, "draft storage must never fan out multiple rows");
}

// ---------------------------------------------------------------------------
// Oversized payloads are rejected by the use-case cap.
// ---------------------------------------------------------------------------
#[tokio::test]
async fn draft_rejects_oversized_payload() {
    let pool = build_pool().await;
    let huge = "x".repeat(500_001);

    let err = save_uc(&pool)
        .execute(&huge)
        .await
        .expect_err("an oversized draft must be rejected");
    assert!(
        matches!(err, AppError::Invalid(_)),
        "expected Invalid(size cap), got {err:?}"
    );
    assert_eq!(
        repo(&pool).get().await.unwrap(),
        None,
        "rejected writes must leave no partial draft behind"
    );
}