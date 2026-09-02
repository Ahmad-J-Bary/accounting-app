use application::errors::AppError;
use application::ports::payment_repository::PaymentRepository;
use async_trait::async_trait;
use domain::payments::Payment;
use domain::shared::ids::{CustomerId, PaymentId, SupplierId};
use sqlx::SqlitePool;
use std::sync::Arc;

mod commands;
mod mappers;
mod models;
mod queries;

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

    async fn save_settlement(
        &self,
        payment: &Payment,
        entry: &domain::accounting::journal_entry::JournalEntry,
        customer: Option<&domain::customers::Customer>,
        supplier: Option<&domain::suppliers::Supplier>,
    ) -> Result<(), AppError> {
        commands::save_settlement(&self.pool, payment, entry, customer, supplier).await
    }

    async fn save_with_accounting(
        &self,
        payment: &Payment,
        entry: Option<&domain::accounting::journal_entry::JournalEntry>,
        delete_entries: &[domain::shared::ids::JournalEntryId],
        customers: &[domain::customers::Customer],
        suppliers: &[domain::suppliers::Supplier],
        accounts: &[domain::accounting::account::Account],
    ) -> Result<(), AppError> {
        commands::save_with_accounting(
            &self.pool,
            payment,
            entry,
            delete_entries,
            customers,
            suppliers,
            accounts,
        )
        .await
    }

    async fn delete_with_accounting(
        &self,
        payment_id: &domain::shared::ids::PaymentId,
        delete_entries: &[domain::shared::ids::JournalEntryId],
        customers: &[domain::customers::Customer],
        suppliers: &[domain::suppliers::Supplier],
        accounts: &[domain::accounting::account::Account],
    ) -> Result<(), AppError> {
        commands::delete_with_accounting(
            &self.pool,
            payment_id,
            delete_entries,
            customers,
            suppliers,
            accounts,
        )
        .await
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
