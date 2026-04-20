use std::sync::Arc;
use uuid::Uuid;

use domain::shared::JournalEntryId;
use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::journal_entry_dto::JournalEntryDto;

pub struct PostJournalEntryUseCase {
    repo: Arc<dyn JournalEntryRepository>,
}

impl PostJournalEntryUseCase {
    pub fn new(repo: Arc<dyn JournalEntryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, entry_id: String) -> Result<JournalEntryDto, AppError> {
        let id = JournalEntryId(
            Uuid::parse_str(&entry_id)
                .map_err(|e| AppError::Invalid(format!("Invalid entry ID: {}", e)))?
        );

        let mut entry = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("Journal entry not found".into()))?;

        entry.post().map_err(AppError::from)?;

        self.repo.save(&entry).await?;

        Ok(JournalEntryDto::from(entry))
    }
}
