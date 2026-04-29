use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::stock_movement_repository::StockMovementRepository;
use domain::inventory::stock_movement::{StockMovement};
use domain::shared::ids::{StockMovementId, MaterialId};
use rust_decimal::Decimal;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteStockMovementRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteStockMovementRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl StockMovementRepository for SqliteStockMovementRepository {
    async fn save(&self, movement: &StockMovement) -> Result<(), AppError> {
        commands::save(&self.pool, movement).await
    }

    async fn find_by_id(&self, id: &StockMovementId) -> Result<Option<StockMovement>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<StockMovement>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn list_by_material(&self, material_id: &MaterialId) -> Result<Vec<StockMovement>, AppError> {
        queries::list_by_material(&self.pool, material_id).await
    }

    async fn get_stock_balance(&self, material_id: &MaterialId) -> Result<Decimal, AppError> {
        queries::get_stock_balance(&self.pool, material_id).await
    }
}
