use std::sync::Arc;
use crate::errors::AppError;
use crate::ports::code_prefix_repository::CodePrefixRepository;
use crate::ports::category_repository::CategoryRepository;
use domain::inventory::category::MaterialCategory;
use domain::inventory::code_policy::CodeGenerator;
use domain::shared::ids::MaterialCategoryId;
use std::str::FromStr;

pub struct MaterialCodeUseCases {
    prefix_repo: Arc<dyn CodePrefixRepository>,
    category_repo: Arc<dyn CategoryRepository>,
}

impl MaterialCodeUseCases {
    pub fn new(
        prefix_repo: Arc<dyn CodePrefixRepository>,
        category_repo: Arc<dyn CategoryRepository>,
    ) -> Self {
        Self { prefix_repo, category_repo }
    }

    fn resolve_prefix(&self, category: &MaterialCategory) -> String {
        category.code_prefix.clone().unwrap_or_else(|| "غ".to_string())
    }

    pub async fn generate_code(&self, category_id: String) -> Result<String, AppError> {
        let cid = MaterialCategoryId::from_str(&category_id)
            .map_err(|_| AppError::Invalid("معرف تصنيف غير صالح".into()))?;

        let category = self.category_repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("التصنيف غير موجود".into()))?;

        let prefix = self.resolve_prefix(&category);

        // Get and increment sequence in one atomic call
        let seq = self.prefix_repo.get_next_sequence(&category_id).await?;

        // Generate the code string
        let code = CodeGenerator::generate_sequential_code(&prefix, seq)
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        Ok(code)
    }

    pub async fn preview_code(&self, category_id: String) -> Result<String, AppError> {
        let cid = MaterialCategoryId::from_str(&category_id)
            .map_err(|_| AppError::Invalid("معرف تصنيف غير صالح".into()))?;

        let category = self.category_repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("التصنيف غير موجود".into()))?;

        let prefix = self.resolve_prefix(&category);

        // Peek without incrementing
        let seq = self.prefix_repo.preview_next_sequence(&category_id).await?;

        let code = CodeGenerator::generate_sequential_code(&prefix, seq)
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        Ok(code)
    }
}
