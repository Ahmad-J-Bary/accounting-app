use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::opening_draft_repository::OpeningDraftRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::settings_repository::SettingsRepository;

use super::guard::assert_opening_workflow_writable;

const MAX_DRAFT_BYTES: usize = 500_000;

pub struct GetOpeningDraftUseCase {
    repo: Arc<dyn OpeningDraftRepository>,
}

impl GetOpeningDraftUseCase {
    pub fn new(repo: Arc<dyn OpeningDraftRepository>) -> Self {
        Self { repo }
    }

    /// Read-only: the draft is served even after the lifecycle closes so an
    /// audit view can still show what was saved (no data is ever deleted).
    pub async fn execute(&self) -> Result<Option<String>, AppError> {
        self.repo.get().await
    }
}

pub struct SaveOpeningDraftUseCase {
    repo: Arc<dyn OpeningDraftRepository>,
    settings_repo: Arc<dyn SettingsRepository>,
    migration_repo: Arc<dyn OpeningMigrationRepository>,
}

impl SaveOpeningDraftUseCase {
    pub fn new(
        repo: Arc<dyn OpeningDraftRepository>,
        settings_repo: Arc<dyn SettingsRepository>,
        migration_repo: Arc<dyn OpeningMigrationRepository>,
    ) -> Self {
        Self { repo, settings_repo, migration_repo }
    }

    pub async fn execute(&self, data: &str) -> Result<(), AppError> {
        if data.len() > MAX_DRAFT_BYTES {
            return Err(AppError::Invalid(
                "مسودة الرصيد الافتتاحي كبيرة جداً — قلّص البيانات ثم أعد الحفظ".into(),
            ));
        }
        // Draft writes are opening-workflow writes — rejected for NEW
        // companies and once the lifecycle is closed (a Locked migration).
        assert_opening_workflow_writable(&self.settings_repo, &self.migration_repo).await?;
        self.repo.save(data).await
    }
}

pub struct ClearOpeningDraftUseCase {
    repo: Arc<dyn OpeningDraftRepository>,
}

impl ClearOpeningDraftUseCase {
    pub fn new(repo: Arc<dyn OpeningDraftRepository>) -> Self {
        Self { repo }
    }

    /// Cleanup, not a workflow write: allowed even at the lock boundary so the
    /// wizard can drop its draft residue after the migration is sealed.
    pub async fn execute(&self) -> Result<(), AppError> {
        self.repo.clear().await
    }
}