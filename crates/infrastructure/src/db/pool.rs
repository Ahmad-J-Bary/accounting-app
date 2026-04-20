use sqlx::SqlitePool;
use std::sync::Arc;

pub type DbPool = Arc<SqlitePool>;

pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let pool = SqlitePool::connect(database_url).await?;
    Ok(Arc::new(pool))
}

// Database connection pool and migration runner (Force rebuild: 2026-04-21T00:31)
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./src/db/migrations").run(pool).await
}
