use sqlx::SqlitePool;
use std::sync::Arc;

pub type DbPool = Arc<SqlitePool>;

pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let pool = SqlitePool::connect(database_url).await?;
    Ok(Arc::new(pool))
}
