use crate::dto::damaged_dto::{CreateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use chrono::{DateTime, Utc};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::inventory::DamagedItem;
use domain::shared::ids::MaterialId;
use rust_decimal::Decimal;
use std::sync::Arc;

pub struct CreateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl CreateDamagedItemUseCase {
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

    pub async fn execute(&self, req: CreateDamagedItemRequest) -> Result<DamagedItemDto, AppError> {
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

        let item = DamagedItem::new(
            material_id,
            quantity,
            req.reason.clone(),
            damage_date,
            cost_impact,
            req.notes,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save(&item).await?;

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
            req.reason.clone(),
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.movement_repo.save(&movement).await?;

        Ok(to_dto(item, Some(reference)))
    }
}

pub fn to_dto(d: DamagedItem, reference: Option<String>) -> DamagedItemDto {
    DamagedItemDto {
        id: d.id.to_string(),
        material_id: d.material_id.to_string(),
        material_name: None,
        quantity: d.quantity.to_string(),
        reason: d.reason,
        damage_date: d.damage_date.to_rfc3339(),
        cost_impact: d.cost_impact.to_string(),
        notes: d.notes,
        reference,
        created_at: d.created_at.to_rfc3339(),
    }
}
