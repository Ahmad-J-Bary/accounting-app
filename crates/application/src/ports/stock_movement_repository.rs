use async_trait::async_trait;
use domain::inventory::stock_movement::StockMovement;
use domain::shared::ids::{StockMovementId, MaterialId};
use rust_decimal::Decimal;
use crate::errors::AppError;
use crate::dto::stock_dto::StockMovementDetailDto;

pub struct MaterialInventorySummary {
    pub total_received: Decimal,
    pub total_sold: Decimal,
    pub total_available: Decimal,
    pub total_damaged: Decimal,
    pub last_purchase_price: Decimal,
    pub last_purchase_price_base: Decimal,
    pub last_sale_price: Decimal,
    pub last_sale_price_base: Decimal,
    pub average_cost: Decimal,
    pub average_cost_base: Decimal,
    pub average_raw_price_base: Decimal,
}

#[async_trait]
pub trait StockMovementRepository: Send + Sync {
    async fn save(&self, movement: &StockMovement) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &StockMovementId) -> Result<Option<StockMovement>, AppError>;
    async fn list_all(&self) -> Result<Vec<StockMovement>, AppError>;
    async fn list_by_material(&self, material_id: &MaterialId) -> Result<Vec<StockMovement>, AppError>;
    async fn get_stock_balance(&self, material_id: &MaterialId) -> Result<Decimal, AppError>;
    async fn get_material_summary(&self, material_id: &MaterialId) -> Result<MaterialInventorySummary, AppError>;
    async fn list_detailed_by_material(&self, material_id: &MaterialId) -> Result<Vec<StockMovementDetailDto>, AppError>;
    async fn list_by_reference(&self, reference: &str) -> Result<Vec<StockMovement>, AppError>;
    async fn delete_by_reference(&self, reference: &str, movement_type: &str) -> Result<(), AppError>;
    async fn get_next_inventory_reference(&self) -> Result<String, AppError>;
}
