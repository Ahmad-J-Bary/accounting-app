use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::category_repository::CategoryRepository;
use domain::inventory::category::MaterialCategory;
use domain::shared::ids::MaterialCategoryId;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteCategoryRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCategoryRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CategoryRepository for SqliteCategoryRepository {
    async fn save(&self, category: &MaterialCategory) -> Result<(), AppError> {
        commands::save(&self.pool, category).await
    }

    async fn find_by_id(&self, id: &MaterialCategoryId) -> Result<Option<MaterialCategory>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_name(&self, name: &str) -> Result<Option<MaterialCategory>, AppError> {
        queries::find_by_name(&self.pool, name).await
    }

    async fn list_all(&self) -> Result<Vec<MaterialCategory>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn update(&self, category: &MaterialCategory) -> Result<(), AppError> {
        commands::update(&self.pool, category).await
    }

    async fn delete(&self, id: &MaterialCategoryId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn count_materials_in_category(&self, id: &MaterialCategoryId) -> Result<u64, AppError> {
        queries::count_materials_in_category(&self.pool, id).await
    }
}
