use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_item_repository::OpeningItemRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::reconcile::{readiness_blockers, GetOpeningReconciliationUseCase};
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
            .ok_or_else(|| AppError::NotFound("ØªØ±Ø­ÙŠÙ„ Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø§ÙØªØªØ§Ø­ÙŠ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯".into()))?;
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
            .ok_or_else(|| AppError::NotFound("ØªØ±Ø­ÙŠÙ„ Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø§ÙØªØªØ§Ø­ÙŠ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯".into()))?;
        migration.approve(&by).map_err(AppError::Domain)?;
        self.repo.update(&migration).await?;
        Ok(OpeningMigrationDto(migration))
    }
}

/// Locks a posted migration. The Opening Balance Control account (53) must be
/// zero and the sub-ledgers must reconcile before locking; the domain enforces
/// the Posted-state precondition.
pub struct LockOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    detail_repo: Arc<dyn OpeningItemRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl LockOpeningBalanceUseCase {
    pub fn new(
        repo: Arc<dyn OpeningMigrationRepository>,
        detail_repo: Arc<dyn OpeningItemRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            repo,
            detail_repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, id: String) -> Result<OpeningMigrationDto, AppError> {
        let mut migration = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ØªØ±Ø­ÙŠÙ„ Ø§Ù„Ø±ØµÙŠØ¯ Ø§Ù„Ø§ÙØªØªØ§Ø­ÙŠ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯".into()))?;
        migration.lock().map_err(AppError::Domain)?;

        let recon = GetOpeningReconciliationUseCase::new(
            self.repo.clone(),
            self.detail_repo.clone(),
            self.account_repo.clone(),
            self.journal_repo.clone(),
        )
        .execute(id)
        .await?;

        let blockers = readiness_blockers(&recon, true);
        if !blockers.is_empty() {
            return Err(AppError::Invalid(blockers.join("Ø› ")));
        }

        self.repo.update(&migration).await?;
        Ok(OpeningMigrationDto(migration))
    }
}