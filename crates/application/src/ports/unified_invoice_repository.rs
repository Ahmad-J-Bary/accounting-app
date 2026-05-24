use async_trait::async_trait;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType};
use crate::errors::AppError;
use domain::shared::ids::InvoiceId;

#[async_trait]
pub trait UnifiedInvoiceRepository: Send + Sync {
    async fn save(&self, invoice: &UnifiedInvoice) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &InvoiceId) -> Result<Option<UnifiedInvoice>, AppError>;
    async fn list_all(&self) -> Result<Vec<UnifiedInvoice>, AppError>;
    async fn list_by_type(&self, invoice_type: InvoiceType) -> Result<Vec<UnifiedInvoice>, AppError>;
    async fn update(&self, invoice: &UnifiedInvoice) -> Result<(), AppError>;
    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError>;
    async fn get_last_original_prices(&self, material_id: &str) -> Result<(String, String), AppError>;
    async fn get_next_invoice_number(&self, invoice_type: InvoiceType) -> Result<String, AppError>;
}
