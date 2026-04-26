use async_trait::async_trait;
use domain::inventory::stock_movement::StockMovement;
use domain::shared::ids::{StockMovementId, MaterialId};
use rust_decimal::Decimal;
use crate::errors::AppError;

#[async_trait]
pub trait StockMovementRepository: Send + Sync {
    async fn save(&self, movement: &StockMovement) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &StockMovementId) -> Result<Option<StockMovement>, AppError>;
    async fn list_all(&self) -> Result<Vec<StockMovement>, AppError>;
    async fn list_by_material(&self, material_id: &MaterialId) -> Result<Vec<StockMovement>, AppError>;
    async fn get_stock_balance(&self, material_id: &MaterialId) -> Result<Decimal, AppError>;
}
