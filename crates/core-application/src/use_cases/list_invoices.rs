use std::sync::Arc;
use uuid::Uuid;

use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::dto::invoice_dto::InvoiceDto;

pub struct ListInvoicesUseCase {
    repo: Arc<dyn InvoiceRepository>,
}

impl ListInvoicesUseCase {
    pub fn new(repo: Arc<dyn InvoiceRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, customer_id: Option<String>) -> Result<Vec<InvoiceDto>, AppError> {
        let invoices = if let Some(cid) = customer_id {
            let id = Uuid::parse_str(&cid)
                .map_err(|e| AppError::Invalid(format!("Invalid customer ID: {}", e)))?;
            self.repo.list_for_customer(id).await?
        } else {
            self.repo.list_all().await?
        };

        Ok(invoices.into_iter().map(InvoiceDto::from).collect())
    }
}
