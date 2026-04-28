use std::sync::Arc;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::material_dto::{MaterialDto};
use crate::errors::AppError;

pub struct MaterialQueries {
    repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl MaterialQueries {
    pub fn new(
        repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, movement_repo }
    }

    pub async fn list_all(&self) -> Result<Vec<MaterialDto>, AppError> {
        let materials = self.repo.list_all().await?;
        let mut dtos = vec![];
        for m in materials {
            let mid = m.id.clone();
            let mut dto = MaterialDto::from(m);
            let balance = self.movement_repo.get_stock_balance(&mid).await?;
            dto.stock_quantity = balance.to_string();
            dtos.push(dto);
        }
        Ok(dtos)
    }

    pub async fn get_by_id(&self, id: String) -> Result<MaterialDto, AppError> {
        let mid = id.parse().map_err(|_| AppError::NotFound("معرف المادة غير صالح".into()))?;
        let material = self.repo.find_by_id(&mid).await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let mut dto = MaterialDto::from(material);
        let balance = self.movement_repo.get_stock_balance(&mid).await?;
        dto.stock_quantity = balance.to_string();
        Ok(dto)
    }
}
