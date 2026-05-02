use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use domain::sales::unified_invoice::{InvoiceType};
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{InvoiceId};
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::invoice_dto::{InvoiceDto};
use crate::errors::AppError;

pub struct PostInvoiceUseCase {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl PostInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, movement_repo }
    }

    pub async fn execute(&self, id: String) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let mut invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        invoice.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        let movement_type = match invoice.invoice_type {
            InvoiceType::Sales => MovementType::Sale,
            InvoiceType::Purchase => MovementType::Purchase,
            InvoiceType::OpeningBalance => MovementType::OpeningBalance,
        };

        for line in &invoice.lines {
            let movement = StockMovement::new(
                line.material_id.clone(),
                movement_type.clone(),
                line.quantity,
                line.unit_price.amount(),
                line.line_total().amount(),
                invoice.invoice_number.clone(),
                format!("{:?} بموجب فاتورة رقم {}", invoice.invoice_type, invoice.invoice_number),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.movement_repo.save(&movement).await?;
        }

        self.repo.update(&invoice).await?;
        Ok(InvoiceDto::from(invoice))
    }
}
