use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::OpeningMigrationDto;

/// Moves an opening-balance migration to `Validated`.
/// Structural validation (accounting equation / reconciliation) is enforced by
/// the reconciliation engine feeding this transition; the domain records the
/// validated state.
pub struct ValidateOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
}

impl ValidateOpeningBalanceUseCase {
    pub fn new(repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String, by: String) -> Result<OpeningMigrationDto, AppError> {
        let mut migration = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;
        migration.validate(&by).map_err(AppError::Domain)?;
        self.repo.update(&migration).await?;
        Ok(OpeningMigrationDto(migration))
    }
}

/// Moves a validated migration to `Approved`.
pub struct ApproveOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
}

impl ApproveOpeningBalanceUseCase {
    pub fn new(repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String, by: String) -> Result<OpeningMigrationDto, AppError> {
        let mut migration = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;
        migration.approve(&by).map_err(AppError::Domain)?;
        self.repo.update(&migration).await?;
        Ok(OpeningMigrationDto(migration))
    }
}

/// Locks a posted migration. The controller must ensure the Opening Balance
/// Control account is zero before calling; the domain enforces the Posted-state
/// precondition.
pub struct LockOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
}

impl LockOpeningBalanceUseCase {
    pub fn new(repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<OpeningMigrationDto, AppError> {
        let mut migration = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;
        migration.lock().map_err(AppError::Domain)?;
        self.repo.update(&migration).await?;
        Ok(OpeningMigrationDto(migration))
    }
}