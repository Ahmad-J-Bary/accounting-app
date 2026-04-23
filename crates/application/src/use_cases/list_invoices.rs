use std::sync::Arc;
use uuid::Uuid;

use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::product_repository::ProductRepository;
use crate::dto::invoice_dto::InvoiceDto;

pub struct ListInvoicesUseCase {
    repo: Arc<dyn InvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    product_repo: Arc<dyn ProductRepository>,
}

impl ListInvoicesUseCase {
    pub fn new(
        repo: Arc<dyn InvoiceRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        product_repo: Arc<dyn ProductRepository>,
    ) -> Self {
        Self { repo, customer_repo, product_repo }
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
            
            // Populate Customer Name
            if let Ok(id) = Uuid::parse_str(&dto.customer_id) {
                if let Ok(Some(customer)) = self.customer_repo.find_by_id(&domain::shared::ids::CustomerId(id)).await {
                    dto.customer_name = Some(customer.name);
                }
            }
            
            // Populate Product Names
            for line in &mut dto.lines {
                if let Ok(pid) = Uuid::parse_str(&line.product_id) {
                    if let Ok(Some(product)) = self.product_repo.find_by_id(&domain::shared::ids::ProductId(pid)).await {
                        line.product_name = Some(product.name);
                    }
                }
            }
            dtos.push(dto);
        }

        Ok(dtos)
    }
}
