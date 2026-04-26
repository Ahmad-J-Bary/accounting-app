use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::inventory::StockAdjustment;
use domain::shared::ids::MaterialId;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::adjustment_dto::{CreateStockAdjustmentRequest, StockAdjustmentDto};
use crate::errors::AppError;

fn to_dto(a: StockAdjustment) -> StockAdjustmentDto {
    StockAdjustmentDto {
        id: a.id.to_string(),
        material_id: a.material_id.to_string(),
        material_name: None,
        system_quantity: a.system_quantity.to_string(),
        actual_quantity: a.actual_quantity.to_string(),
        difference: a.difference.to_string(),
        reason: a.reason,
        adjustment_date: a.adjustment_date.to_rfc3339(),
        created_at: a.created_at.to_rfc3339(),
    }
}

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

        let _material = self.material_repo.find_by_id(&material_id).await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let current_balance = self.movement_repo.get_stock_balance(&material_id).await?;

        let actual_quantity = Decimal::try_from(req.actual_quantity)
            .map_err(|_| AppError::Invalid("الكمية الفعلية غير صالحة".into()))?;

        let adjustment_date = DateTime::parse_from_rfc3339(&req.adjustment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let adjustment = StockAdjustment::new(
            material_id,
            current_balance,
            actual_quantity,
            req.reason,
            adjustment_date,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.adjustment_repo.save(&adjustment).await?;
        Ok(to_dto(adjustment))
    }
}

pub struct ListStockAdjustmentsUseCase {
    repo: Arc<dyn StockAdjustmentRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl ListStockAdjustmentsUseCase {
    pub fn new(repo: Arc<dyn StockAdjustmentRepository>, material_repo: Arc<dyn MaterialRepository>) -> Self {
        Self { repo, material_repo }
    }

    pub async fn execute(&self) -> Result<Vec<StockAdjustmentDto>, AppError> {
        let adjustments = self.repo.list_all().await?;
        let mut dtos = Vec::new();
        for adj in adjustments {
            let mut dto = to_dto(adj.clone());
            if let Ok(Some(material)) = self.material_repo.find_by_id(&adj.material_id).await {
                dto.material_name = Some(material.name);
            }
            dtos.push(dto);
        }
        Ok(dtos)
    }
}
