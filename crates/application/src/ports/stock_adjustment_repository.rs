use async_trait::async_trait;
use domain::inventory::StockAdjustment;
use domain::shared::ids::StockAdjustmentId;
use crate::errors::AppError;

#[async_trait]
pub trait StockAdjustmentRepository: Send + Sync {
    async fn save(&self, adjustment: &StockAdjustment) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &StockAdjustmentId) -> Result<Option<StockAdjustment>, AppError>;
    async fn list_all(&self) -> Result<Vec<StockAdjustment>, AppError>;
    async fn delete(&self, id: &StockAdjustmentId) -> Result<(), AppError>;
    async fn count(&self) -> Result<i64, AppError>;
}
