use crate::errors::AppError;
use async_trait::async_trait;
use domain::inventory::ProductionOrder;
use domain::shared::ids::ProductionOrderId;

#[async_trait]
pub trait ProductionRepository: Send + Sync {
    async fn save(&self, order: &ProductionOrder) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &ProductionOrderId)
        -> Result<Option<ProductionOrder>, AppError>;
    async fn list_all(&self) -> Result<Vec<ProductionOrder>, AppError>;
    async fn update(&self, order: &ProductionOrder) -> Result<(), AppError>;
    async fn delete(&self, id: &ProductionOrderId) -> Result<(), AppError>;
}
