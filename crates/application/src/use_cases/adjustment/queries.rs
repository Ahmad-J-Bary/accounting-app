use std::sync::Arc;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::adjustment_dto::{StockAdjustmentDto};
use crate::errors::AppError;
use domain::shared::ids::StockAdjustmentId;
use super::create::to_dto;

pub struct StockAdjustmentQueries {
    repo: Arc<dyn StockAdjustmentRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl StockAdjustmentQueries {
    pub fn new(repo: Arc<dyn StockAdjustmentRepository>, material_repo: Arc<dyn MaterialRepository>) -> Self {
        Self { repo, material_repo }
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
                Ok(Some(to_dto(adj, material_name)))
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
            dtos.push(to_dto(adj, material_name));
        }
        Ok(dtos)
    }
}
