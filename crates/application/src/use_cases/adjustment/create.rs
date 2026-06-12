use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::inventory::StockAdjustment;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::MaterialId;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::adjustment_dto::{CreateStockAdjustmentRequest, StockAdjustmentDto};
use crate::errors::AppError;

pub struct CreateStockAdjustmentUseCase {
    adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl CreateStockAdjustmentUseCase {
    pub fn new(
        adjustment_repo: Arc<dyn StockAdjustmentRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { adjustment_repo, material_repo, movement_repo }
    }

    pub async fn execute(&self, req: CreateStockAdjustmentRequest) -> Result<StockAdjustmentDto, AppError> {
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

        let adjustment = StockAdjustment::new(
            material_id,
            current_balance,
            actual_quantity,
            req.reason,
            unit_cost,
            req.notes.clone(),
            adjustment_date,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.adjustment_repo.save(&adjustment).await?;

        // Create a stock movement for inventory tracking
        let difference = adjustment.difference;
        let abs_diff = difference.abs();
        if abs_diff > Decimal::ZERO {
            let reference = adjustment.id.to_string();
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
            let total_cost_value = unit_cost;
            let movement_notes = if let Some(ref user_notes) = req.notes {
                format!("{} - {}", notes, user_notes)
            } else {
                notes
            };
            let mut movement = StockMovement::new(
                adjustment.material_id,
                MovementType::Adjustment,
                abs_diff,
                quantity_unit_cost,
                total_cost_value,
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

pub fn to_dto(a: StockAdjustment, material_name: String) -> StockAdjustmentDto {
    let diff = a.difference;
    let unit_cost_base = if diff != Decimal::ZERO {
        a.unit_cost / diff.abs()
    } else {
        Decimal::ZERO
    };
    StockAdjustmentDto {
        id: a.id.to_string(),
        material_id: a.material_id.to_string(),
        material_name: Some(material_name),
        system_quantity: a.system_quantity.to_string(),
        actual_quantity: a.actual_quantity.to_string(),
        difference: diff.to_string(),
        reason: a.reason,
        unit_cost: unit_cost_base.to_string(),
        unit_cost_base: unit_cost_base.to_string(),
        total_cost: a.unit_cost.to_string(),
        total_cost_base: a.unit_cost.to_string(),
        notes: a.notes,
        adjustment_date: a.adjustment_date.to_rfc3339(),
        created_at: a.created_at.to_rfc3339(),
    }
}
