use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::material_repository::MaterialRepository;
use domain::inventory::material::Material;
use domain::shared::ids::{MaterialId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteMaterialRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteMaterialRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl MaterialRepository for SqliteMaterialRepository {
    async fn save(&self, material: &Material) -> Result<(), AppError> {
        commands::save(&self.pool, material).await
    }

    async fn find_by_id(&self, id: &MaterialId) -> Result<Option<Material>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_code_or_barcode(&self, code_or_barcode: &str) -> Result<Option<Material>, AppError> {
        queries::find_by_code_or_barcode(&self.pool, code_or_barcode).await
    }

    async fn list_all(&self) -> Result<Vec<Material>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn update(&self, material: &Material) -> Result<(), AppError> {
        commands::update(&self.pool, material).await
    }

    async fn delete_material(&self, id: &MaterialId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn add_unit(&self, material_id: &MaterialId, name: String, factor: rust_decimal::Decimal, barcode: Option<String>) -> Result<(), AppError> {
        commands::add_unit(&self.pool, material_id, name, factor, barcode).await
    }

    async fn delete_unit(&self, unit_id: &str) -> Result<(), AppError> {
        commands::delete_unit(&self.pool, unit_id).await
    }
}
