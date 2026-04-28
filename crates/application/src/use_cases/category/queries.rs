use std::sync::Arc;
use domain::inventory::category::{DEFAULT_CATEGORY_NAME};
use crate::ports::category_repository::CategoryRepository;
use crate::dto::category_dto::{CategoryDto};
use crate::errors::AppError;

pub struct CategoryQueries {
    repo: Arc<dyn CategoryRepository>,
}

impl CategoryQueries {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_all(&self) -> Result<Vec<CategoryDto>, AppError> {
        let categories = self.repo.list_all().await?;
        let mut dtos = vec![];
        for cat in categories {
            let mut dto = CategoryDto::from(cat);
            if dto.name == DEFAULT_CATEGORY_NAME && (dto.code_prefix.is_none() || dto.code_prefix.as_ref().unwrap().is_empty()) {
                dto.code_prefix = Some("غ".to_string());
            }
            let count = self
                .repo
                .count_materials_in_category(&dto.id.parse().unwrap())
                .await?;
            dto.material_count = count;
            dtos.push(dto);
        }
        Ok(dtos)
    }
}
