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
                // Calculate effective quantity in base units
                let effective_quantity = line.quantity * line.conversion_factor.unwrap_or(rust_decimal::Decimal::ONE);

                let cost_price = line.purchase_price.as_ref()
                    .map(|m| m.original.amount())
                    .unwrap_or(rust_decimal::Decimal::ZERO);
                let total_cost = cost_price * line.quantity;

                let auto_notes = format!("بيع بموجب فاتورة مبيعات رقم {}", invoice.invoice_number);
                let movement_notes = line.notes.clone().filter(|n| !n.trim().is_empty()).unwrap_or(auto_notes);
                let movement = StockMovement::new(
                    material.id.clone(),
                    MovementType::Sale,
                    effective_quantity,
                    cost_price,
                    total_cost,
                    invoice.invoice_number.clone(),
                    movement_notes,
                    chrono::Utc::now(),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;
                self.movement_repo.save(&movement).await?;
            }
        }

        self.repo.save(&invoice).await?;

        let mut dto = InvoiceDto::from(invoice);
        
        // Enrich with customer name
        if let Ok(id) = dto.customer_id.parse::<CustomerId>() {
            if let Ok(Some(customer)) = self.customer_repo.find_by_id(&id).await {
                dto.customer_name = Some(customer.name);
            }
        }
        
        // Enrich with material names
        for line in &mut dto.lines {
            if let Ok(mid) = line.material_id.parse::<MaterialId>() {
                if let Ok(Some(material)) = self.material_repo.find_by_id(&mid).await {
                    line.material_name = Some(material.name);
                }
            }
        }

        Ok(dto)
    }
}
