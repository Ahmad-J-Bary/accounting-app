use async_trait::async_trait;
use domain::purchases::PurchaseInvoice;
use domain::shared::ids::{PurchaseInvoiceId, SupplierId};
use crate::errors::AppError;

#[async_trait]
pub trait PurchaseInvoiceRepository: Send + Sync {
    async fn save(&self, invoice: &PurchaseInvoice) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &PurchaseInvoiceId) -> Result<Option<PurchaseInvoice>, AppError>;
    async fn list_all(&self) -> Result<Vec<PurchaseInvoice>, AppError>;
    async fn list_by_supplier(&self, supplier_id: &SupplierId) -> Result<Vec<PurchaseInvoice>, AppError>;
    async fn update(&self, invoice: &PurchaseInvoice) -> Result<(), AppError>;
    async fn delete(&self, id: &PurchaseInvoiceId) -> Result<(), AppError>;
}
