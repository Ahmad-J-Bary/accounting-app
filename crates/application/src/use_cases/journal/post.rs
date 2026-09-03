use std::sync::Arc;
use uuid::Uuid;

use crate::dto::journal_entry_dto::JournalEntryDto;
use crate::errors::AppError;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::use_cases::shared::fiscal_lifecycle::FiscalLifecyclePolicy;
use domain::shared::JournalEntryId;

pub struct PostJournalEntryUseCase {
    repo: Arc<dyn JournalEntryRepository>,
    fiscal_year_repo: Arc<dyn FiscalYearRepository>,
    fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl PostJournalEntryUseCase {
    pub fn new(
        repo: Arc<dyn JournalEntryRepository>,
        fiscal_year_repo: Arc<dyn FiscalYearRepository>,
        fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
    ) -> Self {
        Self {
            repo,
            fiscal_year_repo,
            fiscal_period_repo,
        }
    }

    pub async fn execute(&self, entry_id: String) -> Result<JournalEntryDto, AppError> {
        let id = JournalEntryId(
            Uuid::parse_str(&entry_id)
                .map_err(|e| AppError::Invalid(format!("Invalid entry ID: {}", e)))?,
        );

        let mut entry = self
            .repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| AppError::NotFound("Journal entry not found".into()))?;

        FiscalLifecyclePolicy::new(self.fiscal_year_repo.clone(), self.fiscal_period_repo.clone())
            .validate_normal_operational(None, entry.entry_date)
            .await?;

        entry.post().map_err(AppError::from)?;

        self.repo.save(&entry).await?;

        Ok(JournalEntryDto::from(entry))
    }
}
