use std::sync::Arc;
use rust_decimal::Decimal;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::adjustment_dto::{StockAdjustmentDto};
use crate::errors::AppError;
use domain::shared::ids::StockAdjustmentId;
use super::create::to_dto;

pub struct StockAdjustmentQueries {
    repo: Arc<dyn StockAdjustmentRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl StockAdjustmentQueries {
    pub fn new(
        repo: Arc<dyn StockAdjustmentRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, material_repo, movement_repo }
    }

    /// Resolve the currency + fx rate recorded on the adjustment's stock
    /// movement (defaults to base SAR when no foreign currency was recorded).
    async fn resolve_currency(&self, reference: &Option<String>) -> (String, Decimal) {
        let Some(ref_code) = reference else {
            return (super::create::BASE_CURRENCY.to_string(), Decimal::ONE);
        };
        let movements = self.movement_repo.list_by_reference(ref_code).await.unwrap_or_default();
        let Some(m) = movements.first() else {
            return (super::create::BASE_CURRENCY.to_string(), Decimal::ONE);
        };
        (
            m.original_currency.clone().unwrap_or_else(|| super::create::BASE_CURRENCY.to_string()),
            m.fx_rate,
        )
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<StockAdjustmentDto>, AppError> {
        let adj_id = id.parse::<StockAdjustmentId>()
            .map_err(|_| AppError::Invalid("معرف التسوية غير صالح".into()))?;
        let adjustment = self.repo.find_by_id(&adj_id).await?;
        match adjustment {
            Some(adj) => {
                let material_name = self.material_repo.find_by_id(&adj.material_id).await
                    .ok()
                    .flatten()
                    .map(|m| m.name)
                    .unwrap_or_default();
                let (currency_code, fx_rate) = self.resolve_currency(&adj.reference).await;
                Ok(Some(to_dto(adj, material_name, currency_code, fx_rate)))
            }
            None => Ok(None),
        }
    }

    pub async fn list_all(&self) -> Result<Vec<StockAdjustmentDto>, AppError> {
        let adjustments = self.repo.list_all().await?;
        let mut dtos = Vec::new();
        for adj in adjustments {
            let material_name = self.material_repo.find_by_id(&adj.material_id).await
                .ok()
                .flatten()
                .map(|m| m.name)
                .unwrap_or_default();
            let (currency_code, fx_rate) = self.resolve_currency(&adj.reference).await;
            dtos.push(to_dto(adj, material_name, currency_code, fx_rate));
        }
        Ok(dtos)
    }
}
