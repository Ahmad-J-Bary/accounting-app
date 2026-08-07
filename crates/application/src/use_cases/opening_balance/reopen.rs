use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::OpeningMigrationDto;

/// Re-opens a cancelled (pre-posting) opening-balance migration back to
/// `Draft` so it can be edited and re-run through the lifecycle. Guarded by the
/// domain to reject migrations that were cancelled only after posting (those
/// must be re-created instead).
pub struct ReopenOpeningBalanceUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl ReopenOpeningBalanceUseCase {
    pub fn new(migration_repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { migration_repo }
    }

    pub async fn execute(&self, id: String) -> Result<OpeningMigrationDto, AppError> {
        let mut migration = self.migration_repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        migration.reopen().map_err(AppError::Domain)?;
        self.migration_repo.update(&migration).await?;

        Ok(OpeningMigrationDto(migration))
    }
}