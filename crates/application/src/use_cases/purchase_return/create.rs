use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::returns::{PurchaseReturn};
use domain::returns::purchase_return::PurchaseReturnLine;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{MaterialId, SupplierId, PurchaseReturnId};
use crate::ports::purchase_return_repository::PurchaseReturnRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::returns_dto::{CreatePurchaseReturnRequest, PurchaseReturnDto};
use crate::errors::AppError;

pub struct CreatePurchaseReturnUseCase {
    repo: Arc<dyn PurchaseReturnRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
}

impl CreatePurchaseReturnUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseReturnRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, movement_repo, material_repo, supplier_repo }
    }

    pub async fn execute(&self, req: CreatePurchaseReturnRequest) -> Result<PurchaseReturnDto, AppError> {
        let supplier_id = SupplierId::from_str(&req.supplier_id)
            .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;

        let return_date = chrono::DateTime::parse_from_rfc3339(&req.return_date)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let return_number = if req.return_number.trim().is_empty() || req.return_number == "تلقائي" {
            self.repo.get_next_return_number().await?
        } else {
            req.return_number
        };

        let mut ret = PurchaseReturn::new(
            return_number.clone(),
            supplier_id,
            return_date,
            req.notes,
        ).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;

        // If editing (id provided), reuse existing ID and delete old stock movements
        if let Some(ref edit_id) = req.id {
            ret.id = PurchaseReturnId::from_str(edit_id)
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

            let line = PurchaseReturnLine::new(
                material_id,
                quantity,
                unit_price,
                line_dto.unit_id,
                line_dto.notes,
            ).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;
            ret.add_line(line).map_err(|e: domain::shared::errors::DomainError| AppError::Invalid(e.to_string()))?;
        }

        self.repo.save(&ret).await?;

        // Create stock movements (OUTFLOW - goods returned to supplier)
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
                MovementType::PurchaseReturn,
                effective_quantity,
                unit_cost,
                line.line_total,
                ret.return_number.clone(),
                format!("مرتجع مشتريات رقم {} - {}",
                    ret.return_number,
                    line.notes.as_deref().unwrap_or("")),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.movement_repo.save(&movement).await?;
        }

        let mut dto = PurchaseReturnDto::from(ret);
        if let Ok(id) = SupplierId::from_str(&dto.supplier_id) {
            if let Ok(Some(s)) = self.supplier_repo.find_by_id(&id).await {
                dto.supplier_name = Some(s.name);
            }
        }
        Ok(dto)
    }
}
