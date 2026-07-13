use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::invoice_repository::InvoiceRepository;
use domain::sales::Invoice;
use domain::shared::ids::{InvoiceId, CustomerId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteInvoiceRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteInvoiceRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl InvoiceRepository for SqliteInvoiceRepository {
    async fn save(&self, invoice: &Invoice) -> Result<(), AppError> {
        commands::save(&self.pool, invoice).await
    }

    async fn find_by_id(&self, id: &InvoiceId) -> Result<Option<Invoice>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_for_customer(&self, customer_id: CustomerId) -> Result<Vec<Invoice>, AppError> {
        queries::list_for_customer(&self.pool, customer_id).await
    }

    async fn list_all(&self) -> Result<Vec<Invoice>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }
}
