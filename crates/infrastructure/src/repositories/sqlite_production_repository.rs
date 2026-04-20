use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::production_repository::ProductionRepository;
use domain::inventory::ProductionOrder;
use domain::shared::ids::ProductionOrderId;

pub struct SqliteProductionRepository {
    #[allow(dead_code)]
    pool: Arc<SqlitePool>,
}

impl SqliteProductionRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ProductionRepository for SqliteProductionRepository {
    async fn save(&self, _order: &ProductionOrder) -> Result<(), AppError> {
        Ok(())
    }

    async fn find_by_id(&self, _id: &ProductionOrderId) -> Result<Option<ProductionOrder>, AppError> {
        Ok(None)
    }

    async fn list_all(&self) -> Result<Vec<ProductionOrder>, AppError> {
        Ok(vec![])
    }

    async fn update(&self, _order: &ProductionOrder) -> Result<(), AppError> {
        Ok(())
    }

    async fn delete(&self, _id: &ProductionOrderId) -> Result<(), AppError> {
        Ok(())
    }
}
