use std::sync::Arc;
use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::journal_entry_dto::JournalEntryDto;

pub struct ListJournalEntriesUseCase {
    repo: Arc<dyn JournalEntryRepository>,
}

impl ListJournalEntriesUseCase {
    pub fn new(repo: Arc<dyn JournalEntryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<JournalEntryDto>, AppError> {
        let entries = self.repo.list_all().await?;
        let dtos = entries.into_iter().map(JournalEntryDto::from).collect();
        Ok(dtos)
    }
}
