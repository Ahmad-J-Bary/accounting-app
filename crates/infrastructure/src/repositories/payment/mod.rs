use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::payment_repository::PaymentRepository;
use domain::payments::Payment;
use domain::shared::ids::{PaymentId, CustomerId, SupplierId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqlitePaymentRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePaymentRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PaymentRepository for SqlitePaymentRepository {
    async fn save(&self, payment: &Payment) -> Result<(), AppError> {
        commands::save(&self.pool, payment).await
    }

    async fn find_by_id(&self, id: &PaymentId) -> Result<Option<Payment>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<Payment>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn list_by_customer(&self, customer_id: &CustomerId) -> Result<Vec<Payment>, AppError> {
        queries::list_by_customer(&self.pool, customer_id).await
    }

    async fn list_by_supplier(&self, supplier_id: &SupplierId) -> Result<Vec<Payment>, AppError> {
        queries::list_by_supplier(&self.pool, supplier_id).await
    }

    async fn delete(&self, id: &PaymentId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn delete_by_invoice_id(&self, invoice_id: &str) -> Result<(), AppError> {
        queries::delete_by_invoice_id(&self.pool, invoice_id).await
    }
}
