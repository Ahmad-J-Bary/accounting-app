use application::errors::AppError;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use async_trait::async_trait;
use domain::accounting::OpeningBalanceMigration;
use sqlx::SqlitePool;
use std::sync::Arc;

mod items;
mod mappers;
mod models;
mod posting;
mod queries;

pub use items::SqliteOpeningItemRepository;
pub use posting::SqliteOpeningPostingRepository;

pub struct SqliteOpeningMigrationRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteOpeningMigrationRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl OpeningMigrationRepository for SqliteOpeningMigrationRepository {
    async fn create(&self, m: &OpeningBalanceMigration) -> Result<(), AppError> {
        queries::create(&self.pool, m).await
    }

    async fn update(&self, m: &OpeningBalanceMigration) -> Result<(), AppError> {
        queries::update(&self.pool, m).await
    }

    async fn find_by_id(&self, id: &str) -> Result<Option<OpeningBalanceMigration>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_cutover_date(
        &self,
        cutover_date: &str,
    ) -> Result<Vec<OpeningBalanceMigration>, AppError> {
        queries::find_by_cutover_date(&self.pool, cutover_date).await
    }

    async fn list(&self) -> Result<Vec<OpeningBalanceMigration>, AppError> {
        queries::list(&self.pool).await
    }

    async fn delete(&self, id: &str) -> Result<(), AppError> {
        queries::delete(&self.pool, id).await
    }
}
