use async_trait::async_trait;
use domain::shared::ids::MaterialCategoryId;
use domain::inventory::category::MaterialCategory;
use crate::errors::AppError;

#[async_trait]
pub trait CategoryRepository: Send + Sync {
    async fn save(&self, category: &MaterialCategory) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &MaterialCategoryId) -> Result<Option<MaterialCategory>, AppError>;
    async fn find_by_name(&self, name: &str) -> Result<Option<MaterialCategory>, AppError>;
    async fn list_all(&self) -> Result<Vec<MaterialCategory>, AppError>;
    async fn update(&self, category: &MaterialCategory) -> Result<(), AppError>;
    async fn delete(&self, id: &MaterialCategoryId) -> Result<(), AppError>;
    async fn count_materials_in_category(&self, id: &MaterialCategoryId) -> Result<u64, AppError>;
}
