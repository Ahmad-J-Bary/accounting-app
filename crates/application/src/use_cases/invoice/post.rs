use crate::dto::invoice_dto::InvoiceDto;
use crate::errors::AppError;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::sales::Invoice;
use domain::shared::ids::{CustomerId, MaterialId};
use domain::shared::InvoiceId;
use std::sync::Arc;
use uuid::Uuid;

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
        Self {
            repo,
            customer_repo,
            material_repo,
            movement_repo,
        }
    }

    pub async fn execute(&self, invoice_id: String) -> Result<InvoiceDto, AppError> {
        let id = InvoiceId(
            Uuid::parse_str(&invoice_id)
                .map_err(|e| AppError::Invalid(format!("Invalid invoice ID: {}", e)))?,
        );

        let mut invoice: Invoice = self
            .repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| AppError::NotFound("Invoice not found".into()))?;

        invoice.post().map_err(AppError::from)?;

        // Record movements
        for line in &invoice.lines {
            if let Ok(Some(material)) = self.material_repo.find_by_id(&line.material_id).await {
                // Record stock movement
                let base_notes = line
                    .notes
                    .clone()
                    .filter(|n| !n.trim().is_empty())
                    .unwrap_or_default();
                let movement_notes =
                    format!("{} - رقم الفاتورة {}", base_notes, invoice.invoice_number);
                let movement = StockMovement::new(
                    material.id,
                    MovementType::Sale,
                    line.quantity,
                    line.unit_price.amount(),
                    line.line_total().amount(),
                    invoice.invoice_number.clone(),
                    movement_notes,
                    chrono::Utc::now(),
                )
                .map_err(|e| AppError::Invalid(e.to_string()))?;
                self.movement_repo.save(&movement).await?;
            }
        }

        self.repo.save(&invoice).await?;

        let mut dto = InvoiceDto::from(invoice);

        // Enrich with customer name
        if let Some(id_str) = &dto.customer_id {
            if let Ok(id) = id_str.parse::<CustomerId>() {
                if let Ok(Some(customer)) = self.customer_repo.find_by_id(&id).await {
                    dto.customer_name = Some(customer.name);
                }
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
