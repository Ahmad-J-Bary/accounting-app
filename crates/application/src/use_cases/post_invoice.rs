use std::sync::Arc;
use uuid::Uuid;

use domain::shared::InvoiceId;
use domain::shared::ids::{CustomerId, MaterialId};
use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use crate::dto::invoice_dto::InvoiceDto;

pub struct PostInvoiceUseCase {
    repo: Arc<dyn InvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl PostInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn InvoiceRepository>, 
        customer_repo: Arc<dyn CustomerRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, customer_repo, material_repo, movement_repo }
    }

    pub async fn execute(&self, invoice_id: String) -> Result<InvoiceDto, AppError> {
        let id = InvoiceId(
            Uuid::parse_str(&invoice_id)
                .map_err(|e| AppError::Invalid(format!("Invalid invoice ID: {}", e)))?
        );

        let mut invoice = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("Invoice not found".into()))?;

        invoice.post().map_err(AppError::from)?;

        // Record movements (stock balance is calculated dynamically now)
        for line in &invoice.lines {
            if let Ok(Some(material)) = self.material_repo.find_by_id(&line.material_id).await {
                // Record stock movement
                let movement = StockMovement::new(
                    material.id.clone(),
                    MovementType::Sale,
                    line.quantity,
                    invoice.invoice_number.clone(),
                    format!("بيع بموجب فاتورة مبيعات رقم {}", invoice.invoice_number),
                    chrono::Utc::now(),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;
                self.movement_repo.save(&movement).await?;
            }
        }

        self.repo.save(&invoice).await?;

        let mut dto = InvoiceDto::from(invoice);
        
        // Enrich with customer name
        if let Ok(id) = dto.customer_id.parse::<u64>() {
            if let Ok(Some(customer)) = self.customer_repo.find_by_id(&CustomerId::from_u64(id)).await {
                dto.customer_name = Some(customer.name);
            }
        }
        
        // Enrich with material names
        for line in &mut dto.lines {
            if let Ok(pid) = Uuid::parse_str(&line.material_id) {
                if let Ok(Some(material)) = self.material_repo.find_by_id(&MaterialId(pid)).await {
                    line.material_name = Some(material.name);
                }
            }
        }

        Ok(dto)
    }
}
