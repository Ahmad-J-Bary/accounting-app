use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::damaged_item_repository::DamagedItemRepository;
use domain::inventory::DamagedItem;
use domain::shared::ids::{DamagedItemId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteDamagedItemRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteDamagedItemRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl DamagedItemRepository for SqliteDamagedItemRepository {
    async fn save(&self, item: &DamagedItem) -> Result<(), AppError> {
        commands::save(&self.pool, item).await
    }

    async fn find_by_id(&self, id: &DamagedItemId) -> Result<Option<DamagedItem>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<DamagedItem>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn delete(&self, id: &DamagedItemId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn count(&self) -> Result<i64, AppError> {
        queries::count(&self.pool).await
    }
}
