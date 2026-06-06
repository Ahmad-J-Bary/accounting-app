use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::inventory_lot_repository::InventoryLotRepository;
use domain::inventory::inventory_lot::InventoryLot;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteInventoryLotRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteInventoryLotRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl InventoryLotRepository for SqliteInventoryLotRepository {
    async fn save(&self, lot: &InventoryLot) -> Result<(), AppError> {
        commands::save(&self.pool, lot).await
    }

    async fn find_available_by_material(&self, material_id: &str) -> Result<Vec<InventoryLot>, AppError> {
        queries::find_available_by_material(&self.pool, material_id).await
    }

    async fn find_by_movement_id(&self, movement_id: &str) -> Result<Vec<InventoryLot>, AppError> {
        queries::find_by_movement_id(&self.pool, movement_id).await
    }

    async fn find_by_purchase_invoice(&self, invoice_id: &str) -> Result<Vec<InventoryLot>, AppError> {
        queries::find_by_purchase_invoice(&self.pool, invoice_id).await
    }

    async fn count_active_by_material(&self, material_id: &str) -> Result<i64, AppError> {
        queries::count_active_by_material(&self.pool, material_id).await
    }

    async fn get_costing_method(&self, material_id: &str) -> Result<String, AppError> {
        queries::get_costing_method(&self.pool, material_id).await
    }

    async fn update_remaining(&self, lot_id: &str, new_quantity_remaining: &str) -> Result<(), AppError> {
        commands::update_remaining(&self.pool, lot_id, new_quantity_remaining).await
    }

    async fn delete_by_movement_id(&self, movement_id: &str) -> Result<(), AppError> {
        commands::delete_by_movement_id(&self.pool, movement_id).await
    }

    async fn delete_by_purchase_invoice(&self, invoice_id: &str) -> Result<(), AppError> {
        commands::delete_by_purchase_invoice(&self.pool, invoice_id).await
    }

    async fn delete_by_material(&self, material_id: &str) -> Result<(), AppError> {
        commands::delete_by_material(&self.pool, material_id).await
    }

    async fn update_costing_method(&self, material_id: &str, costing_method: &str) -> Result<(), AppError> {
        commands::update_costing_method(&self.pool, material_id, costing_method).await
    }
}
