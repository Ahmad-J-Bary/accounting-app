use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_item_repository::OpeningItemRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::reconcile::{readiness_blockers, GetOpeningReconciliationUseCase};
use crate::use_cases::opening_balance::types::OpeningMigrationDto;
use domain::accounting::MigrationStatus;

/// Moves an opening-balance migration to `Validated`.
/// Structural validation (accounting equation / reconciliation) is enforced
/// here — the same gates as posting (Debit = Credit, sub-ledgers reconciled,
/// no unresolved difference) must clear before the migration may be marked
/// validated; the domain then records the state.
pub struct ValidateOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    detail_repo: Arc<dyn OpeningItemRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl ValidateOpeningBalanceUseCase {
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

    pub async fn execute(&self, id: String, by: String) -> Result<OpeningMigrationDto, AppError> {
        let mut migration = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        // Enforcement gate (same as posting): the opening lines must be in
        // equilibrium AND the entered sub-ledger details must reconcile to the
        // general ledger. No silent plug account may pass validation.
        let recon = GetOpeningReconciliationUseCase::new(
            self.repo.clone(),
            self.detail_repo.clone(),
            self.account_repo.clone(),
            self.journal_repo.clone(),
        )
        .execute(id)
        .await?;

        let blockers = readiness_blockers(&recon, false);
        if !blockers.is_empty() {
            return Err(AppError::Invalid(blockers.join("؛ ")));
        }

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
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;
        if migration.status != MigrationStatus::Posted {
            return Err(AppError::Forbidden(
                "لا يمكن قفل إلا الترحيل المرحل".into(),
            ));
        }

        // Phase 4 guard: an UNRESOLVED residual must never be locked — the
        // residual must be reclassified into a designated equity account first
        // (the readiness gate below structurally requires OBE 53 = 0, but this
        // explicit guard gives the exact reason to the user).
        if migration
            .residual_classification
            .map(|c| !c.allows_posting())
            .unwrap_or(false)
        {
            return Err(AppError::Forbidden(
                "الفرق غير محلول: لا يمكن قفل الترحيل حتى يُحل الرصيد المتبقي (صنّفه أو عالج الفرق)".into(),
            ));
        }

        // Gate FIRST, transition after: the Opening Balance Control (53) must be
        // zero and the sub-ledgers reconciled before the aggregate is marked
        // Locked, so a rejected lock never mutates the migration even in memory
        // (mirrors Validate/Post, which run readiness before the domain change).
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
            return Err(AppError::Invalid(blockers.join("؛ ")));
        }

        migration.lock().map_err(AppError::Domain)?;

        self.repo.update(&migration).await?;
        Ok(OpeningMigrationDto(migration))
    }
}