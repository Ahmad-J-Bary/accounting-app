use async_trait::async_trait;
use sqlx::SqlitePool;
use core_application::errors::AppError;
use core_application::ports::invoice_repository::InvoiceRepository;
use core_domain::sales::{Invoice, InvoiceId};
use std::sync::Arc;

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
        sqlx::query(
            "INSERT INTO invoices (id, customer_id, issued_at, posted) VALUES (?, ?, ?, ?)"
        )
        .bind(invoice.id.0.to_string())
        .bind(invoice.customer_id.0.to_string())
        .bind(invoice.issued_at)
        .bind(invoice.posted)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, _id: &InvoiceId) -> Result<Option<Invoice>, AppError> {
        // TODO: Implement database read
        Ok(None)
    }

    async fn list_for_customer(&self, _customer_id: uuid::Uuid) -> Result<Vec<Invoice>, AppError> {
        // TODO: Implement database read
        Ok(vec![])
    }

    async fn list_all(&self) -> Result<Vec<Invoice>, AppError> {
        // TODO: Implement database read
        Ok(vec![])
    }

    async fn delete(&self, _id: &InvoiceId) -> Result<(), AppError> {
        // TODO: Implement database delete
        Ok(())
    }
}
