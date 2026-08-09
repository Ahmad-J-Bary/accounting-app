use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::purchase_invoice_repository::PurchaseInvoiceRepository;
use domain::purchases::PurchaseInvoice;
use domain::shared::ids::{PurchaseInvoiceId, SupplierId};

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqlitePurchaseInvoiceRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePurchaseInvoiceRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PurchaseInvoiceRepository for SqlitePurchaseInvoiceRepository {
    async fn save(&self, invoice: &PurchaseInvoice) -> Result<(), AppError> {
        commands::save(&self.pool, invoice).await
    }

    async fn find_by_id(&self, id: &PurchaseInvoiceId) -> Result<Option<PurchaseInvoice>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<PurchaseInvoice>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn list_by_supplier(&self, supplier_id: &SupplierId) -> Result<Vec<PurchaseInvoice>, AppError> {
        queries::list_by_supplier(&self.pool, supplier_id).await
    }

    async fn update(&self, invoice: &PurchaseInvoice) -> Result<(), AppError> {
        commands::update(&self.pool, invoice).await
    }

    async fn delete(&self, id: &PurchaseInvoiceId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn post_with_accounting(
        &self,
        invoice: &PurchaseInvoice,
        movements: &[domain::inventory::stock_movement::StockMovement],
        entries: &[domain::accounting::journal_entry::JournalEntry],
    ) -> Result<(), AppError> {
        commands::post_with_accounting(&self.pool, invoice, movements, entries).await
    }
}
