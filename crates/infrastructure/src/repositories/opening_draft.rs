use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::opening_draft_repository::OpeningDraftRepository;
use std::sync::Arc;

pub struct SqliteOpeningDraftRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteOpeningDraftRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl OpeningDraftRepository for SqliteOpeningDraftRepository {
    async fn get(&self) -> Result<Option<String>, AppError> {
        sqlx::query_scalar("SELECT data FROM opening_wizard_draft WHERE id = 'default'")
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))
    }

    async fn save(&self, data: &str) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO opening_wizard_draft (id, company_id, data, updated_at)
             VALUES ('default', 'default', ?, ?)
             ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
        )
        .bind(data)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn clear(&self) -> Result<(), AppError> {
        sqlx::query("DELETE FROM opening_wizard_draft WHERE id = 'default'")
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}