use crate::errors::AppError;
use async_trait::async_trait;
use domain::sales::{Invoice, InvoiceId};

#[async_trait]
pub trait InvoiceRepository: Send + Sync {
    async fn save(&self, invoice: &Invoice) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &InvoiceId) -> Result<Option<Invoice>, AppError>;
    async fn list_for_customer(
        &self,
        customer_id: domain::shared::ids::CustomerId,
    ) -> Result<Vec<Invoice>, AppError>;
    async fn list_all(&self) -> Result<Vec<Invoice>, AppError>;
    async fn delete(&self, id: &InvoiceId) -> Result<(), AppError>;
}
