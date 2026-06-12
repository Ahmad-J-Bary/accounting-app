use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{StockAdjustmentId, MaterialId};
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::adjustment_dto::{UpdateStockAdjustmentRequest, StockAdjustmentDto};
use crate::errors::AppError;
use super::create::to_dto;

pub struct UpdateStockAdjustmentUseCase {
    adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl UpdateStockAdjustmentUseCase {
    pub fn new(
        adjustment_repo: Arc<dyn StockAdjustmentRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { adjustment_repo, material_repo, movement_repo }
    }

    pub async fn execute(&self, req: UpdateStockAdjustmentRequest) -> Result<StockAdjustmentDto, AppError> {
        let id = req.id.parse::<StockAdjustmentId>()
            .map_err(|_| AppError::Invalid("معرف التسوية غير صالح".into()))?;

        let mut adjustment = self.adjustment_repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("التسوية غير موجودة".into()))?;

        let material_id = req.material_id.parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;

        let material = self.material_repo.find_by_id(&material_id).await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let current_balance = self.movement_repo.get_stock_balance(&material_id).await?;

        let actual_quantity = Decimal::try_from(req.actual_quantity)
            .map_err(|_| AppError::Invalid("الكمية المجرود غير صالحة".into()))?;

        let unit_cost = Decimal::try_from(req.unit_cost)
            .map_err(|_| AppError::Invalid("التكلفة غير صالحة".into()))?;

        let adjustment_date = DateTime::parse_from_rfc3339(&req.adjustment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        if current_balance < Decimal::ZERO {
            return Err(AppError::Invalid("كمية النظام لا يمكن أن تكون سالبة".into()));
        }
        if actual_quantity < Decimal::ZERO {
            return Err(AppError::Invalid("الكمية المجرودة لا يمكن أن تكون سالبة".into()));
        }

        adjustment.material_id = material_id;
        adjustment.system_quantity = current_balance;
        adjustment.actual_quantity = actual_quantity;
        adjustment.difference = actual_quantity - current_balance;
        adjustment.reason = req.reason;
        adjustment.unit_cost = unit_cost;
        adjustment.notes = req.notes;
        adjustment.adjustment_date = adjustment_date;

        // Delete old stock movement
        let reference = adjustment.reference.clone().unwrap_or_else(|| adjustment.id.to_string());
        self.movement_repo.delete_by_reference(&reference, "Adjustment").await?;

        self.adjustment_repo.save(&adjustment).await?;

        // Create new stock movement
        let difference = adjustment.difference;
        let abs_diff = difference.abs();
        if abs_diff > Decimal::ZERO {
            let notes = if difference > Decimal::ZERO {
                "تسوية: فائض".to_string()
            } else {
                "تسوية: عجز".to_string()
            };
            let quantity_unit_cost = if abs_diff > Decimal::ZERO {
                unit_cost / abs_diff
            } else {
                Decimal::ZERO
            };
            let movement_notes = if let Some(ref user_notes) = adjustment.notes {
                format!("{} - {}", notes, user_notes)
            } else {
                notes
            };
            let mut movement = StockMovement::new(
                adjustment.material_id,
                MovementType::Adjustment,
                abs_diff,
                quantity_unit_cost,
                unit_cost,
                reference,
                movement_notes,
                adjustment.adjustment_date,
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.signed_quantity = Some(difference);
            self.movement_repo.save(&movement).await?;
        }

        Ok(to_dto(adjustment, material.name))
    }
}
