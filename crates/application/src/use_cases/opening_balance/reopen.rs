use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::guard::opening_lifecycle_closed;
use crate::use_cases::opening_balance::types::OpeningMigrationDto;

/// Re-opens a cancelled (pre-posting) opening-balance migration back to
/// `Draft` so it can be edited and re-run through the lifecycle. Guarded by the
/// domain to reject migrations that were cancelled only after posting (those
/// must be re-created instead), and by the Phase 5 lifecycle: once ANY
/// migration is Locked the workflow is sealed and cannot be re-opened.
pub struct ReopenOpeningBalanceUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl ReopenOpeningBalanceUseCase {
    pub fn new(migration_repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { migration_repo }
    }

    pub async fn execute(&self, id: String) -> Result<OpeningMigrationDto, AppError> {
        let migration = self.migration_repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        // Phase 5: the opening lifecycle is a one-way door — once any migration
        // is Locked the workflow closes and cancelled migrations stay cancelled.
        if opening_lifecycle_closed(&self.migration_repo).await? {
            return Err(AppError::Forbidden(
                "الرصيد الافتتاحي للشركة أُقفل نهائياً — لا يمكن إعادة فتح ترحيلات الرصيد الافتتاحي بعد إقفال الرصيد"
                    .into(),
            ));
        }

        let mut migration = migration;
        migration.reopen().map_err(AppError::Domain)?;
        self.migration_repo.update(&migration).await?;

        Ok(OpeningMigrationDto(migration))
    }
}