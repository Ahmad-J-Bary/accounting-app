use async_trait::async_trait;
use domain::inventory::inventory_lot::InventoryLot;
use crate::errors::AppError;

#[async_trait]
pub trait InventoryLotRepository: Send + Sync {
    async fn save(&self, lot: &InventoryLot) -> Result<(), AppError>;
    async fn find_available_by_material(&self, material_id: &str) -> Result<Vec<InventoryLot>, AppError>;
    async fn find_by_material(&self, material_id: &str) -> Result<Vec<InventoryLot>, AppError>;
    async fn find_by_movement_id(&self, movement_id: &str) -> Result<Vec<InventoryLot>, AppError>;
    async fn find_by_purchase_invoice(&self, invoice_id: &str) -> Result<Vec<InventoryLot>, AppError>;
    async fn count_active_by_material(&self, material_id: &str) -> Result<i64, AppError>;
    async fn get_costing_method(&self, material_id: &str) -> Result<String, AppError>;
    async fn update_remaining(&self, lot_id: &str, new_quantity_remaining: &str) -> Result<(), AppError>;
    async fn update_sale_prices(&self, lot_id: &str, retail: Option<&str>, semi_wholesale: Option<&str>, wholesale: Option<&str>) -> Result<(), AppError>;
    async fn delete_by_movement_id(&self, movement_id: &str) -> Result<(), AppError>;
    async fn delete_by_purchase_invoice(&self, invoice_id: &str) -> Result<(), AppError>;
    async fn delete_by_material(&self, material_id: &str) -> Result<(), AppError>;
    async fn update_costing_method(&self, material_id: &str, costing_method: &str) -> Result<(), AppError>;
}
