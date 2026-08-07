use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::opening_migration_repository::OpeningMigrationRepository;
use domain::accounting::OpeningBalanceMigration;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;

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

    async fn list(&self) -> Result<Vec<OpeningBalanceMigration>, AppError> {
        queries::list(&self.pool).await
    }

    async fn delete(&self, id: &str) -> Result<(), AppError> {
        queries::delete(&self.pool, id).await
    }
}