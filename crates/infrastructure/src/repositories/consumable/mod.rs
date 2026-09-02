use application::errors::AppError;
use application::ports::consumable_repository::ConsumableRepository;
use async_trait::async_trait;
use domain::assets::{AssetMovement, Consumable, ConsumableId};
use sqlx::SqlitePool;
use std::sync::Arc;

mod commands;
mod mappers;
mod models;
mod queries;

pub struct SqliteConsumableRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteConsumableRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ConsumableRepository for SqliteConsumableRepository {
    async fn save(&self, consumable: &Consumable) -> Result<(), AppError> {
        commands::save(&self.pool, consumable).await
    }

    async fn find_by_id(&self, id: &ConsumableId) -> Result<Option<Consumable>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self) -> Result<Vec<Consumable>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn delete(&self, id: &ConsumableId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn save_with_accounting(
        &self,
        consumable: &Consumable,
        movements: &[AssetMovement],
        entries: &[domain::accounting::journal_entry::JournalEntry],
    ) -> Result<(), AppError> {
        commands::save_with_accounting(&self.pool, consumable, movements, entries).await
    }
}
