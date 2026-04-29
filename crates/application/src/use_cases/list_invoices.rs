use std::sync::Arc;
use uuid::Uuid;

use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::invoice_dto::InvoiceDto;

pub struct ListInvoicesUseCase {
    repo: Arc<dyn InvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl ListInvoicesUseCase {
    pub fn new(
        repo: Arc<dyn InvoiceRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, customer_repo, material_repo }
    }

    pub async fn execute(&self, customer_id: Option<String>) -> Result<Vec<InvoiceDto>, AppError> {
        let invoices = if let Some(cid) = customer_id {
            let id = cid.parse::<domain::shared::ids::CustomerId>()
                .map_err(|e| AppError::Invalid(format!("Invalid customer ID: {}", e)))?;
            self.repo.list_for_customer(id).await?
        } else {
            self.repo.list_all().await?
        };

        let mut dtos = Vec::new();
        for inv in invoices {
            let mut dto = InvoiceDto::from(inv);
            
            // Populate Customer Name
            if let Ok(id) = dto.customer_id.parse::<domain::shared::ids::CustomerId>() {
                if let Ok(Some(customer)) = self.customer_repo.find_by_id(&id).await {
                    dto.customer_name = Some(customer.name);
                }
            }
            
            // Populate Material Names
            for line in &mut dto.lines {
                if let Ok(mid) = line.material_id.parse::<domain::shared::ids::MaterialId>() {
                    if let Ok(Some(material)) = self.material_repo.find_by_id(&mid).await {
                        line.material_name = Some(material.name);
                    }
                }
            }
            dtos.push(dto);
        }

        Ok(dtos)
    }
}
