use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::OpeningMigrationDto;

pub struct ListOpeningMigrationsUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
}

impl ListOpeningMigrationsUseCase {
    pub fn new(repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<OpeningMigrationDto>, AppError> {
        let migrations = self.repo.list().await?;
        Ok(migrations.into_iter().map(OpeningMigrationDto).collect())
    }
}