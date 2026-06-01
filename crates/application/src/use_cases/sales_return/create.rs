use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::returns::{SalesReturn};
use domain::returns::sales_return::SalesReturnLine;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{MaterialId, CustomerId, SalesReturnId};
use crate::ports::sales_return_repository::SalesReturnRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::returns_dto::{CreateSalesReturnRequest, SalesReturnDto};
use crate::errors::AppError;

pub struct CreateSalesReturnUseCase {
    repo: Arc<dyn SalesReturnRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
}

impl CreateSalesReturnUseCase {
    pub fn new(
        repo: Arc<dyn SalesReturnRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, movement_repo, material_repo, customer_repo }
    }

    pub async fn execute(&self, req: CreateSalesReturnRequest) -> Result<SalesReturnDto, AppError> {
        let customer_id = CustomerId::from_str(&req.customer_id)
            .map_err(|_| AppError::Invalid("معرف العميل غير صالح".into()))?;

        let return_date = chrono::DateTime::parse_from_rfc3339(&req.return_date)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let return_number = if req.return_number.trim().is_empty() || req.return_number == "تلقائي" {
            self.repo.get_next_return_number().await?
        } else {
            req.return_number
        };

        let mut ret = SalesReturn::new(
            return_number.clone(),
            customer_id,
            return_date,
            req.notes,
        ).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;

        // If editing (id provided), reuse existing ID and delete old stock movements
        if let Some(ref edit_id) = req.id {
            ret.id = SalesReturnId::from_str(edit_id)
                .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
            self.movement_repo.delete_by_reference(&return_number).await?;
        }

        for line_dto in req.lines {
            let material_id = MaterialId::from_str(&line_dto.material_id)
                .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
            let unit_price = Decimal::from_str(&line_dto.unit_price)
                .map_err(|_| AppError::Invalid("السعر غير صالح".into()))?;

            let line = SalesReturnLine::new(
                material_id,
                quantity,
                unit_price,
                line_dto.unit_id,
                line_dto.notes,
            ).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;
            ret.add_line(line).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;
        }

        self.repo.save(&ret).await?;

        // Create stock movements (INFLOW - goods returned to inventory)
        for line in &ret.lines {
            let material = self.material_repo.find_by_id(&line.material_id).await?
                .ok_or_else(|| AppError::NotFound(format!("المادة مع المعرف {} غير موجودة", line.material_id)))?;

            let conversion_factor = if let Some(ref unit_id) = line.unit_id {
                material.units.iter()
                    .find(|u| u.id.to_string() == *unit_id)
                    .map(|u| u.conversion_factor)
                    .unwrap_or(Decimal::ONE)
            } else {
                Decimal::ONE
            };

            let effective_quantity = line.quantity * conversion_factor;
            let unit_cost = if effective_quantity > Decimal::ZERO {
                line.line_total / effective_quantity
            } else {
                Decimal::ZERO
            };

            let movement = StockMovement::new(
                line.material_id,
                MovementType::SalesReturn,
                effective_quantity,
                unit_cost,
                line.line_total,
                ret.return_number.clone(),
                format!("مرتجع مبيعات رقم {} - {}",
                    ret.return_number,
                    line.notes.as_deref().unwrap_or("")),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.movement_repo.save(&movement).await?;
        }

        let mut dto = SalesReturnDto::from(ret);
        if let Ok(id) = CustomerId::from_str(&dto.customer_id) {
            if let Ok(Some(c)) = self.customer_repo.find_by_id(&id).await {
                dto.customer_name = Some(c.name);
            }
        }
        Ok(dto)
    }
}
