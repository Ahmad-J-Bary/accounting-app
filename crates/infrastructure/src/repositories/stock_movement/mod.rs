use application::errors::AppError;
use application::ports::stock_movement_repository::StockMovementRepository;
use async_trait::async_trait;
use domain::inventory::stock_movement::StockMovement;
use domain::shared::ids::{MaterialId, StockMovementId};
use rust_decimal::Decimal;
use sqlx::SqlitePool;
use std::sync::Arc;

mod commands;
mod mappers;
mod models;
mod queries;

pub(crate) use commands::insert_movement_tx;

pub struct StockMovementRow {
    pub id: String,
    pub material_id: String,
    pub quantity: String,
    pub unit_cost: String,
    pub unit_cost_base: String,
    pub total_cost: String,
    pub total_cost_base: String,
    pub original_currency: Option<String>,
    pub fx_rate: String,
    pub movement_type: String,
    pub reason: Option<String>,
    pub reference: Option<String>,
    pub document_number: Option<String>,
    pub movement_date: String,
    pub created_at: String,
}

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

    async fn post_with_accounting(
        &self,
        movements: &[StockMovement],
        entries: &[domain::accounting::journal_entry::JournalEntry],
    ) -> Result<(), AppError> {
        crate::repositories::atomic::write_event(
            &self.pool,
            movements,
            entries,
            None,
            &[],
            &[],
            &[],
        )
        .await
    }

    async fn find_by_id(&self, id: &StockMovementId) -> Result<Option<StockMovement>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<StockMovement>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn list_by_material(
        &self,
        material_id: &MaterialId,
    ) -> Result<Vec<StockMovement>, AppError> {
        queries::list_by_material(&self.pool, material_id).await
    }

    async fn get_stock_balance(&self, material_id: &MaterialId) -> Result<Decimal, AppError> {
        queries::get_stock_balance(&self.pool, material_id).await
    }

    async fn get_material_summary(
        &self,
        material_id: &MaterialId,
    ) -> Result<application::ports::stock_movement_repository::MaterialInventorySummary, AppError>
    {
        queries::get_material_summary(&self.pool, material_id).await
    }

    async fn list_detailed_by_material(
        &self,
        material_id: &MaterialId,
    ) -> Result<Vec<application::dto::stock_dto::StockMovementDetailDto>, AppError> {
        queries::list_detailed_by_material(&self.pool, material_id).await
    }

    async fn list_by_reference(&self, reference: &str) -> Result<Vec<StockMovement>, AppError> {
        queries::list_by_reference(&self.pool, reference).await
    }

    async fn list_by_document_number(
        &self,
        document_number: &str,
        movement_type: Option<&str>,
    ) -> Result<Vec<StockMovement>, AppError> {
        queries::list_by_document_number(&self.pool, document_number, movement_type).await
    }

    async fn delete_by_reference(
        &self,
        reference: &str,
        movement_type: &str,
    ) -> Result<(), AppError> {
        commands::delete_by_reference(&self.pool, reference, movement_type).await
    }

    async fn delete_by_document_number(
        &self,
        document_number: &str,
        movement_type: &str,
    ) -> Result<(), AppError> {
        commands::delete_by_document_number(&self.pool, document_number, movement_type).await
    }

    async fn get_next_inventory_reference(&self) -> Result<String, AppError> {
        queries::get_next_inventory_reference(&self.pool).await
    }
}
