use std::sync::Arc;
use rust_decimal::Decimal;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::damaged_dto::{DamagedItemDto};
use crate::errors::AppError;
use super::create::to_dto;

pub struct DamagedItemQueries {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl DamagedItemQueries {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, material_repo, movement_repo }
    }

    /// Resolve the currency + fx rate + base cost recorded on the damaged
    /// item's stock movement (defaults to base SAR when none recorded).
    /// Filters by `movement_type = Damaged` to avoid matching unrelated
    /// movements that happen to share the same reference number.
    async fn resolve(&self, reference: &Option<String>) -> (String, Decimal, Decimal) {
        let Some(ref_code) = reference else {
            return (super::create::BASE_CURRENCY.to_string(), Decimal::ONE, Decimal::ZERO);
        };
        let movements = self.movement_repo.list_by_reference(ref_code).await.unwrap_or_default();
        let m = movements.iter().find(|m| matches!(m.movement_type, domain::inventory::stock_movement::MovementType::Damaged));
        let Some(m) = m else {
            return (super::create::BASE_CURRENCY.to_string(), Decimal::ONE, Decimal::ZERO);
        };
        (
            m.original_currency.clone().unwrap_or_else(|| super::create::BASE_CURRENCY.to_string()),
            m.fx_rate,
            m.total_cost_base,
        )
    }

    pub async fn list_all(&self) -> Result<Vec<DamagedItemDto>, AppError> {
        let items = self.repo.list_all().await?;
        let mut dtos = Vec::new();

        for item in items {
            let (currency_code, fx_rate, cost_impact_base) = self.resolve(&item.reference).await;
            let mut dto = to_dto(
                item.clone(),
                currency_code,
                fx_rate,
                cost_impact_base,
            );
            if let Ok(Some(material)) = self.material_repo.find_by_id(&item.material_id).await {
                dto.material_name = Some(material.name);
            }
            dtos.push(dto);
        }

        Ok(dtos)
    }
}
