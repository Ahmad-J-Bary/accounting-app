use async_trait::async_trait;
use domain::accounting::account::Account;
use domain::accounting::journal_entry::JournalEntry;
use domain::customers::Customer;
use domain::payments::Payment;
use domain::shared::ids::{PaymentId, CustomerId, SupplierId, JournalEntryId};
use domain::suppliers::Supplier;
use crate::errors::AppError;

#[async_trait]
pub trait PaymentRepository: Send + Sync {
    async fn save(&self, payment: &Payment) -> Result<(), AppError>;
    async fn save_settlement(
        &self,
        payment: &Payment,
        entry: &domain::accounting::journal_entry::JournalEntry,
        customer: Option<&Customer>,
        supplier: Option<&Supplier>,
    ) -> Result<(), AppError>;
    async fn save_with_accounting(
        &self,
        payment: &Payment,
        entry: Option<&JournalEntry>,
        delete_entries: &[JournalEntryId],
        customers: &[Customer],
        suppliers: &[Supplier],
        accounts: &[Account],
    ) -> Result<(), AppError>;
    async fn delete_with_accounting(
        &self,
        payment_id: &PaymentId,
        delete_entries: &[JournalEntryId],
        customers: &[Customer],
        suppliers: &[Supplier],
        accounts: &[Account],
    ) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &PaymentId) -> Result<Option<Payment>, AppError>;
    async fn list_all(&self) -> Result<Vec<Payment>, AppError>;
    async fn list_by_customer(&self, customer_id: &CustomerId) -> Result<Vec<Payment>, AppError>;
    async fn list_by_supplier(&self, supplier_id: &SupplierId) -> Result<Vec<Payment>, AppError>;
    async fn delete(&self, id: &PaymentId) -> Result<(), AppError>;
    async fn delete_by_invoice_id(&self, invoice_id: &str) -> Result<(), AppError>;
}
