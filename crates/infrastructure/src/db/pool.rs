use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::sync::Arc;
use std::str::FromStr;
use std::time::Duration;

pub type DbPool = Arc<SqlitePool>;

pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let options = SqliteConnectOptions::from_str(database_url)?
        .busy_timeout(Duration::from_secs(10))
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(false);
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;
        
    Ok(Arc::new(pool))
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::migrate::MigrateError> {
    let migrator = sqlx::migrate!("./src/db/migrations");

    loop {
        match migrator.run(pool).await {
            Ok(()) => return Ok(()),
            Err(sqlx::migrate::MigrateError::VersionMismatch(version)) => {
                if let Some(migration) = migrator.migrations.iter().find(|m| m.version == version) {
                    sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
                        .bind(migration.checksum.as_ref())
                        .bind(version)
                        .execute(pool)
                        .await
                        .map_err(|e| {
                            sqlx::migrate::MigrateError::Source(e.into())
                        })?;
                } else {
                    sqlx::query("DELETE FROM _sqlx_migrations WHERE version = ?")
                        .bind(version)
                        .execute(pool)
                        .await
                        .map_err(|e| {
                            sqlx::migrate::MigrateError::Source(e.into())
                        })?;
                }
                continue;
            }
            Err(sqlx::migrate::MigrateError::VersionMissing(version)) => {
                sqlx::query("DELETE FROM _sqlx_migrations WHERE version = ?")
                    .bind(version)
                    .execute(pool)
                    .await
                    .map_err(|e| {
                        sqlx::migrate::MigrateError::Source(e.into())
                    })?;
                continue;
            }
            Err(e) => return Err(e),
        }
    }
}
