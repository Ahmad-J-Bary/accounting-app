use application::errors::AppError;
use application::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use async_trait::async_trait;
use domain::sales::unified_invoice::{InvoiceType, UnifiedInvoice};
use domain::shared::ids::InvoiceId;
use sqlx::SqlitePool;
use std::sync::Arc;

mod commands;
mod mappers;
mod models;
mod queries;

pub struct SqliteUnifiedInvoiceRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteUnifiedInvoiceRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UnifiedInvoiceRepository for SqliteUnifiedInvoiceRepository {
    async fn save(&self, invoice: &UnifiedInvoice) -> Result<(), AppError> {
        commands::save(&self.pool, invoice).await
    }

    async fn find_by_id(&self, id: &InvoiceId) -> Result<Option<UnifiedInvoice>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<UnifiedInvoice>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn list_by_type(
        &self,
        invoice_type: InvoiceType,
    ) -> Result<Vec<UnifiedInvoice>, AppError> {
        queries::list_by_type(&self.pool, invoice_type).await
    }

    async fn update(&self, invoice: &UnifiedInvoice) -> Result<(), AppError> {
        commands::update(&self.pool, invoice).await
    }

    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn post_with_accounting(
        &self,
        invoice: &UnifiedInvoice,
        movements: &[domain::inventory::stock_movement::StockMovement],
        new_lots: &[domain::inventory::inventory_lot::InventoryLot],
        lot_updates: &[(String, String)],
        material_updates: &[domain::inventory::material::Material],
        entries: &[domain::accounting::journal_entry::JournalEntry],
        payments: &[domain::payments::Payment],
        customers: &[domain::customers::Customer],
        suppliers: &[domain::suppliers::Supplier],
    ) -> Result<(), AppError> {
        commands::post_with_accounting(
            &self.pool,
            invoice,
            movements,
            new_lots,
            lot_updates,
            material_updates,
            entries,
            payments,
            customers,
            suppliers,
        )
        .await
    }

    async fn get_last_original_prices(
        &self,
        material_id: &str,
    ) -> Result<(String, String), AppError> {
        queries::get_last_original_prices(&self.pool, material_id).await
    }

    async fn get_next_invoice_number(&self, invoice_type: InvoiceType) -> Result<String, AppError> {
        let type_str = match invoice_type {
            InvoiceType::Sales => "Sales",
            InvoiceType::Purchase => "Purchase",
            InvoiceType::PurchaseCosts => "PurchaseCosts",
            InvoiceType::OpeningBalance => "OpeningBalance",
        };
        queries::get_next_invoice_number(&self.pool, type_str).await
    }
}
