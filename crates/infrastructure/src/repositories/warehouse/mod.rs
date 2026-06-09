use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::warehouse_repository::WarehouseRepository;
use application::dto::warehouse_dto::{WarehouseDto, CreateWarehouseRequest, UpdateWarehouseRequest};
use domain::shared::ids::WarehouseId;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteWarehouseRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteWarehouseRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl WarehouseRepository for SqliteWarehouseRepository {
    async fn create(&self, req: &CreateWarehouseRequest) -> Result<WarehouseDto, AppError> {
        commands::create(&self.pool, req).await
    }

    async fn find_by_id(&self, id: &WarehouseId) -> Result<Option<WarehouseDto>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<WarehouseDto>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn update(&self, req: &UpdateWarehouseRequest) -> Result<WarehouseDto, AppError> {
        commands::update(&self.pool, req).await
    }

    async fn delete(&self, id: &WarehouseId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn get_default(&self) -> Result<Option<WarehouseDto>, AppError> {
        queries::get_default(&self.pool).await
    }
}
