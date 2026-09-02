use crate::errors::AppError;
use async_trait::async_trait;
use domain::inventory::category::MaterialCategory;
use domain::shared::ids::MaterialCategoryId;

#[async_trait]
pub trait CategoryRepository: Send + Sync {
    async fn save(&self, category: &MaterialCategory) -> Result<(), AppError>;
    async fn find_by_id(
        &self,
        id: &MaterialCategoryId,
    ) -> Result<Option<MaterialCategory>, AppError>;
    async fn find_by_name(&self, name: &str) -> Result<Option<MaterialCategory>, AppError>;
    async fn list_all(&self) -> Result<Vec<MaterialCategory>, AppError>;
    async fn update(&self, category: &MaterialCategory) -> Result<(), AppError>;
    async fn delete(&self, id: &MaterialCategoryId) -> Result<(), AppError>;
    async fn count_materials_in_category(&self, id: &MaterialCategoryId) -> Result<u64, AppError>;
    /// Reassigns every material linked to `from` to `to`. Returns the number
    /// of material_category rows that were moved.
    async fn reassign_materials(
        &self,
        from: &MaterialCategoryId,
        to: &MaterialCategoryId,
    ) -> Result<u64, AppError>;
}
