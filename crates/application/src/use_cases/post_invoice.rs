use std::sync::Arc;
use uuid::Uuid;

use domain::shared::InvoiceId;
use domain::shared::ids::{CustomerId, ProductId};
use crate::errors::AppError;
use crate::ports::invoice_repository::InvoiceRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::product_repository::ProductRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use crate::dto::invoice_dto::InvoiceDto;

pub struct PostInvoiceUseCase {
    repo: Arc<dyn InvoiceRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    product_repo: Arc<dyn ProductRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl PostInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn InvoiceRepository>, 
        customer_repo: Arc<dyn CustomerRepository>,
        product_repo: Arc<dyn ProductRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, customer_repo, product_repo, movement_repo }
    }

    pub async fn execute(&self, invoice_id: String) -> Result<InvoiceDto, AppError> {
        let id = InvoiceId(
            Uuid::parse_str(&invoice_id)
                .map_err(|e| AppError::Invalid(format!("Invalid invoice ID: {}", e)))?
        );

        let mut invoice = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("Invoice not found".into()))?;

        invoice.post().map_err(AppError::from)?;

        // Update stock and record movements
        for line in &invoice.lines {
            if let Some(mut product) = self.product_repo.find_by_id(&line.product_id).await? {
                // Adjust stock (decrease for sales)
                product.adjust_stock(-line.quantity).map_err(|e| AppError::Invalid(e.to_string()))?;
                self.product_repo.update(&product).await?;

                // Record stock movement
                let movement = StockMovement::new(
                    product.id.clone(),
                    MovementType::Out,
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
        if let Ok(id) = Uuid::parse_str(&dto.customer_id) {
            if let Ok(Some(customer)) = self.customer_repo.find_by_id(&CustomerId(id)).await {
                dto.customer_name = Some(customer.name);
            }
        }
        
        // Enrich with product names
        for line in &mut dto.lines {
            if let Ok(pid) = Uuid::parse_str(&line.product_id) {
                if let Ok(Some(product)) = self.product_repo.find_by_id(&ProductId(pid)).await {
                    line.product_name = Some(product.name);
                }
            }
        }

        Ok(dto)
    }
}
