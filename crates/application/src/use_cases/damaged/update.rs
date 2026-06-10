use crate::dto::damaged_dto::{UpdateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use chrono::{DateTime, Utc};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::ids::{DamagedItemId, MaterialId};
use rust_decimal::Decimal;
use std::sync::Arc;
use crate::use_cases::damaged::create::to_dto;

pub struct UpdateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl UpdateDamagedItemUseCase {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self {
            repo,
            material_repo,
            movement_repo,
        }
    }

    pub async fn execute(&self, req: UpdateDamagedItemRequest) -> Result<DamagedItemDto, AppError> {
        let id = req
            .id
            .parse::<DamagedItemId>()
            .map_err(|_| AppError::Invalid("معرف التالف غير صالح".into()))?;

        let mut item = self
            .repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| AppError::NotFound("سجل التالف غير موجود".into()))?;

        let material_id = req
            .material_id
            .parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;

        let _material = self
            .material_repo
            .find_by_id(&material_id)
            .await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let quantity = Decimal::try_from(req.quantity)
            .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
        let cost_impact = Decimal::try_from(req.cost_impact)
            .map_err(|_| AppError::Invalid("قيمة التكلفة غير صالحة".into()))?;
        let damage_date = DateTime::parse_from_rfc3339(&req.damage_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&Utc);

        item.material_id = material_id;
        item.quantity = quantity;
        item.reason = req.reason.clone();
        item.damage_date = damage_date;
        item.cost_impact = cost_impact;
        item.notes = req.notes;

        self.repo.save(&item).await?;

        let old_reference = format!("DAM-{}", item.id);
        self.movement_repo.delete_by_reference(&old_reference, "Damaged").await?;

        let count = self.repo.count().await?;
        let reference = format!("{}", count);
        let unit_cost = if quantity > Decimal::ZERO {
            cost_impact / quantity
        } else {
            Decimal::ZERO
        };
        let movement = StockMovement::new(
            item.material_id,
            MovementType::Damaged,
            quantity,
            unit_cost,
            cost_impact,
            reference.clone(),
            req.reason,
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.movement_repo.save(&movement).await?;

        Ok(to_dto(item, Some(reference)))
    }
}
