use crate::errors::AppError;
use async_trait::async_trait;
use domain::inventory::material::Material;
use domain::shared::ids::MaterialId;

#[async_trait]
pub trait MaterialRepository: Send + Sync {
    async fn save(&self, material: &Material) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &MaterialId) -> Result<Option<Material>, AppError>;
    async fn find_by_code_or_barcode(
        &self,
        code_or_barcode: &str,
    ) -> Result<Option<Material>, AppError>;
    async fn list_all(&self) -> Result<Vec<Material>, AppError>;
    async fn update(&self, material: &Material) -> Result<(), AppError>;
    async fn delete_material(&self, id: &MaterialId) -> Result<(), AppError>;
    async fn add_unit(
        &self,
        material_id: &MaterialId,
        name: String,
        factor: rust_decimal::Decimal,
        barcode: Option<String>,
    ) -> Result<(), AppError>;
    async fn delete_unit(&self, unit_id: &str) -> Result<(), AppError>;
}
