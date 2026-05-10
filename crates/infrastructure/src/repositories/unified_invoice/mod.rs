use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType};
use domain::shared::ids::{InvoiceId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

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

    async fn list_by_type(&self, invoice_type: InvoiceType) -> Result<Vec<UnifiedInvoice>, AppError> {
        queries::list_by_type(&self.pool, invoice_type).await
    }

    async fn update(&self, invoice: &UnifiedInvoice) -> Result<(), AppError> {
        commands::update(&self.pool, invoice).await
    }

    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn get_last_usd_prices(&self, material_id: &str) -> Result<(String, String), AppError> {
        queries::get_last_usd_prices(&self.pool, material_id).await
    }

    async fn get_next_invoice_number(&self) -> Result<String, AppError> {
        queries::get_next_invoice_number(&self.pool).await
    }
}
