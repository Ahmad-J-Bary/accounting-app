use async_trait::async_trait;
use domain::shared::ids::MaterialId;
use domain::inventory::material::Material;
use crate::errors::AppError;

#[async_trait]
pub trait MaterialRepository: Send + Sync {
    async fn save(&self, material: &Material) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &MaterialId) -> Result<Option<Material>, AppError>;
    async fn find_by_code_or_barcode(&self, code_or_barcode: &str) -> Result<Option<Material>, AppError>;
    async fn list_all(&self) -> Result<Vec<Material>, AppError>;
    async fn update(&self, material: &Material) -> Result<(), AppError>;
    async fn delete(&self, id: &MaterialId) -> Result<(), AppError>;
}
