use crate::errors::AppError;
use async_trait::async_trait;
use domain::accounting::journal_entry::JournalEntry;
use domain::inventory::stock_movement::StockMovement;
use domain::purchases::PurchaseInvoice;
use domain::shared::ids::{PurchaseInvoiceId, SupplierId};

#[async_trait]
pub trait PurchaseInvoiceRepository: Send + Sync {
    async fn save(&self, invoice: &PurchaseInvoice) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &PurchaseInvoiceId)
        -> Result<Option<PurchaseInvoice>, AppError>;
    async fn list_all(&self) -> Result<Vec<PurchaseInvoice>, AppError>;
    async fn list_by_supplier(
        &self,
        supplier_id: &SupplierId,
    ) -> Result<Vec<PurchaseInvoice>, AppError>;
    async fn update(&self, invoice: &PurchaseInvoice) -> Result<(), AppError>;
    async fn delete(&self, id: &PurchaseInvoiceId) -> Result<(), AppError>;
    async fn post_with_accounting(
        &self,
        invoice: &PurchaseInvoice,
        movements: &[StockMovement],
        entries: &[JournalEntry],
    ) -> Result<(), AppError>;
}
