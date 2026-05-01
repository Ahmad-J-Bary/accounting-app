use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::sync::Arc;
use std::str::FromStr;
use std::time::Duration;

pub type DbPool = Arc<SqlitePool>;

pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .busy_timeout(Duration::from_secs(10))
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;
        
    Ok(Arc::new(pool))
}

// Database connection pool and migration runner (Force rebuild: 2026-05-01T20:41)
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./src/db/migrations").run(pool).await
}
