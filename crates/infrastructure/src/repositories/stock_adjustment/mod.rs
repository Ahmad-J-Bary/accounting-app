use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::stock_adjustment_repository::StockAdjustmentRepository;
use domain::inventory::StockAdjustment;
use domain::shared::ids::{StockAdjustmentId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteStockAdjustmentRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteStockAdjustmentRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl StockAdjustmentRepository for SqliteStockAdjustmentRepository {
    async fn save(&self, adj: &StockAdjustment) -> Result<(), AppError> {
        commands::save(&self.pool, adj).await
    }

    async fn find_by_id(&self, id: &StockAdjustmentId) -> Result<Option<StockAdjustment>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<StockAdjustment>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn delete(&self, id: &StockAdjustmentId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn count(&self) -> Result<i64, AppError> {
        queries::count(&self.pool).await
    }
}
