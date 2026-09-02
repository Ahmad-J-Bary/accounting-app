use std::sync::Arc;

use application::errors::AppError;
use application::ports::app_config_repository::AppConfigRepository;
use async_trait::async_trait;
use sqlx::SqlitePool;

pub struct SqliteAppConfigRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteAppConfigRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AppConfigRepository for SqliteAppConfigRepository {
    async fn get(&self, key: &str) -> Result<Option<String>, AppError> {
        sqlx::query_scalar::<_, String>("SELECT value FROM app_config WHERE key = ?1")
            .bind(key)
            .fetch_optional(self.pool.as_ref())
            .await
            .map_err(|e| AppError::Infrastructure(format!("app_config get [{key}]: {e}")))
    }

    async fn set(&self, key: &str, value: &str) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO app_config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value)
        .execute(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(format!("app_config set [{key}]: {e}")))?;

        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM app_config WHERE key = ?1")
            .bind(key)
            .execute(self.pool.as_ref())
            .await
            .map_err(|e| AppError::Infrastructure(format!("app_config delete [{key}]: {e}")))?;

        Ok(())
    }
}
