use crate::dto::category_dto::CategoryDto;
use crate::errors::AppError;
use crate::ports::category_repository::CategoryRepository;
use chrono::Utc;
use domain::inventory::category::MaterialCategory;
use domain::shared::ids::MaterialCategoryId;
use std::sync::Arc;

pub struct HybridCategoryUseCase {
    repo: Arc<dyn CategoryRepository>,
}

impl HybridCategoryUseCase {
    pub fn new(repo: Arc<dyn CategoryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, prefixes: Vec<String>) -> Result<CategoryDto, AppError> {
        if prefixes.is_empty() {
            return Err(AppError::Invalid("يجب توفر بادئة واحدة على الأقل".into()));
        }

        let mut sorted_prefixes = prefixes.clone();
        sorted_prefixes.sort();
        let hybrid_prefix = sorted_prefixes.join("");
        let hybrid_name = format!("هجين ({})", hybrid_prefix);

        let all = self.repo.list_all().await?;
        if let Some(existing) = all
            .iter()
            .find(|c| c.is_hybrid && c.code_prefix == Some(hybrid_prefix.clone()))
        {
            return Ok(CategoryDto::from(existing.clone()));
        }

        let category = MaterialCategory {
            id: MaterialCategoryId::new(),
            name: hybrid_name,
            parent_id: None,
            is_active: true,
            is_hybrid: true,
            code_prefix: Some(hybrid_prefix),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.repo.save(&category).await?;
        Ok(CategoryDto::from(category))
    }
}
