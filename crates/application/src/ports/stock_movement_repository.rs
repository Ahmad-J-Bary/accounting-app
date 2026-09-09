use crate::dto::stock_dto::{StockMovementDetailDto, StockMovementDto};
use crate::errors::AppError;
use async_trait::async_trait;
use domain::accounting::journal_entry::JournalEntry;
use domain::inventory::stock_movement::StockMovement;
use domain::shared::ids::{MaterialId, StockMovementId};
use rust_decimal::Decimal;
use std::collections::HashMap;

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
    async fn post_with_accounting(
        &self,
        movements: &[StockMovement],
        entries: &[JournalEntry],
    ) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &StockMovementId) -> Result<Option<StockMovement>, AppError>;
    async fn list_all(&self) -> Result<Vec<StockMovement>, AppError>;
    async fn list_by_material(
        &self,
        material_id: &MaterialId,
    ) -> Result<Vec<StockMovement>, AppError>;
    async fn get_stock_balance(&self, material_id: &MaterialId) -> Result<Decimal, AppError>;
    async fn get_material_summary(
        &self,
        material_id: &MaterialId,
    ) -> Result<MaterialInventorySummary, AppError>;
    async fn list_detailed_by_material(
        &self,
        material_id: &MaterialId,
    ) -> Result<Vec<StockMovementDetailDto>, AppError>;
    async fn list_by_reference(&self, reference: &str) -> Result<Vec<StockMovement>, AppError>;
    async fn list_by_document_number(
        &self,
        document_number: &str,
        movement_type: Option<&str>,
    ) -> Result<Vec<StockMovement>, AppError>;
    async fn delete_by_reference(
        &self,
        reference: &str,
        movement_type: &str,
    ) -> Result<(), AppError>;
    async fn delete_by_document_number(
        &self,
        document_number: &str,
        movement_type: &str,
    ) -> Result<(), AppError>;
    async fn get_next_inventory_reference(&self) -> Result<String, AppError>;

    /// Returns all stock movements with material names resolved via SQL JOIN.
    /// Each tuple contains (dto, document_number) where document_number is the
    /// original document_number field used for source document resolution.
    async fn list_all_with_material_names(
        &self,
    ) -> Result<Vec<(StockMovementDto, Option<String>)>, AppError>;

    /// Returns a mapping of document_number → source_document_id for the given
    /// document numbers, resolved from unified_invoices, legacy sales_invoices,
    /// sales_returns, and purchase_returns in priority order.
    async fn resolve_source_document_ids(
        &self,
        document_numbers: &[String],
    ) -> Result<HashMap<String, String>, AppError>;
}
