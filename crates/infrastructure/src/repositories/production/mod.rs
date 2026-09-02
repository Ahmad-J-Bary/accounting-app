use application::errors::AppError;
use application::ports::production_repository::ProductionRepository;
use async_trait::async_trait;
use domain::inventory::ProductionOrder;
use domain::shared::ids::ProductionOrderId;
use sqlx::SqlitePool;
use std::sync::Arc;

mod commands;
mod mappers;
mod models;
mod queries;

pub struct SqliteProductionRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteProductionRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ProductionRepository for SqliteProductionRepository {
    async fn save(&self, order: &ProductionOrder) -> Result<(), AppError> {
        commands::save(&self.pool, order).await
    }

    async fn find_by_id(
        &self,
        id: &ProductionOrderId,
    ) -> Result<Option<ProductionOrder>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<ProductionOrder>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn update(&self, order: &ProductionOrder) -> Result<(), AppError> {
        commands::update(&self.pool, order).await
    }

    async fn delete(&self, id: &ProductionOrderId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }
}
