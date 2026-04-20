use std::sync::Arc;
use uuid::Uuid;

use domain::shared::InvoiceId;
use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::dto::invoice_dto::InvoiceDto;

pub struct PostInvoiceUseCase {
    repo: Arc<dyn InvoiceRepository>,
}

impl PostInvoiceUseCase {
    pub fn new(repo: Arc<dyn InvoiceRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, invoice_id: String) -> Result<InvoiceDto, AppError> {
        let id = InvoiceId(
            Uuid::parse_str(&invoice_id)
                .map_err(|e| AppError::Invalid(format!("Invalid invoice ID: {}", e)))?
        );

        let mut invoice = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("Invoice not found".into()))?;

        invoice.post().map_err(AppError::from)?;

        self.repo.save(&invoice).await?;

        Ok(InvoiceDto::from(invoice))
    }
}
