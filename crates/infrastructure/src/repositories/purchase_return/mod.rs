use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::purchase_return_repository::PurchaseReturnRepository;
use domain::returns::PurchaseReturn;
use domain::shared::ids::PurchaseReturnId;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqlitePurchaseReturnRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePurchaseReturnRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PurchaseReturnRepository for SqlitePurchaseReturnRepository {
    async fn save(&self, ret: &PurchaseReturn) -> Result<(), AppError> {
        commands::save(&self.pool, ret).await
    }

    async fn find_by_id(&self, id: &PurchaseReturnId) -> Result<Option<PurchaseReturn>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<PurchaseReturn>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn get_next_return_number(&self) -> Result<String, AppError> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT return_number FROM purchase_returns ORDER BY created_at DESC LIMIT 1"
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        match row {
            Some((last,)) => {
                let num: u64 = last.trim_start_matches("PR-").parse().unwrap_or(0);
                Ok(format!("PR-{}", num + 1))
            }
            None => Ok("PR-1".to_string()),
        }
    }
}
