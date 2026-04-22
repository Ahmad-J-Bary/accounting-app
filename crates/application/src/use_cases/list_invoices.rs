use std::sync::Arc;
use uuid::Uuid;

use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::dto::invoice_dto::InvoiceDto;

pub struct ListInvoicesUseCase {
    repo: Arc<dyn InvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
}

impl ListInvoicesUseCase {
    pub fn new(repo: Arc<dyn InvoiceRepository>, customer_repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo, customer_repo }
    }

    pub async fn execute(&self, customer_id: Option<String>) -> Result<Vec<InvoiceDto>, AppError> {
        let invoices = if let Some(cid) = customer_id {
            let id = Uuid::parse_str(&cid)
                .map_err(|e| AppError::Invalid(format!("Invalid customer ID: {}", e)))?;
            self.repo.list_for_customer(id).await?
        } else {
            self.repo.list_all().await?
        };

        let mut dtos = Vec::new();
        for inv in invoices {
            let mut dto = InvoiceDto::from(inv);
            if let Ok(id) = Uuid::parse_str(&dto.customer_id) {
                if let Ok(Some(customer)) = self.customer_repo.find_by_id(&domain::shared::ids::CustomerId(id)).await {
                    dto.customer_name = Some(customer.name);
                }
            }
            dtos.push(dto);
        }

        Ok(dtos)
    }
}
