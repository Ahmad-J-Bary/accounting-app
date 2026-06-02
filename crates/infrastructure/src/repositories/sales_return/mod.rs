use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::sales_return_repository::SalesReturnRepository;
use domain::returns::SalesReturn;
use domain::shared::ids::SalesReturnId;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteSalesReturnRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteSalesReturnRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SalesReturnRepository for SqliteSalesReturnRepository {
    async fn save(&self, ret: &SalesReturn) -> Result<(), AppError> {
        commands::save(&self.pool, ret).await
    }

    async fn find_by_id(&self, id: &SalesReturnId) -> Result<Option<SalesReturn>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<SalesReturn>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn delete(&self, id: &SalesReturnId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn get_next_return_number(&self) -> Result<String, AppError> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT return_number FROM sales_returns ORDER BY created_at DESC LIMIT 1"
        )
        .fetch_optional(self.pool.as_ref())
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        match row {
            Some((last,)) => {
                let num: u64 = last.chars().skip_while(|c| !c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0);
                Ok((num + 1).to_string())
            }
            None => Ok("1".to_string()),
        }
    }
}
