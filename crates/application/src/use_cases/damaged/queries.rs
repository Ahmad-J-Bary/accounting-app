use std::sync::Arc;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::damaged_dto::{DamagedItemDto};
use crate::errors::AppError;
use super::create::to_dto;

pub struct DamagedItemQueries {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl DamagedItemQueries {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, material_repo }
    }

    pub async fn list_all(&self) -> Result<Vec<DamagedItemDto>, AppError> {
        let items = self.repo.list_all().await?;
        let mut dtos = Vec::new();

        for item in items {
            let mut dto = to_dto(item.clone());
            if let Ok(Some(material)) = self.material_repo.find_by_id(&item.material_id).await {
                dto.material_name = Some(material.name);
            }
            dtos.push(dto);
        }

        Ok(dtos)
    }
}
