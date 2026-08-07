use std::sync::Arc;
use uuid::Uuid;

use domain::accounting::journal_entry::{JournalEntry, JournalEntryStatus};
use domain::shared::JournalEntryId;
use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::journal_entry_dto::JournalEntryDto;

/// Reverses a posted journal entry by posting a true contra entry (debit/credit
/// swapped, typed `Reversal`, linked via `reversal_of_entry_id`) and then
/// marking the original entry `Reversed`. Both rows are persisted atomically
/// through `save_reversal_pair` (single transaction).
pub struct ReverseJournalEntryUseCase {
    repo: Arc<dyn JournalEntryRepository>,
}

impl ReverseJournalEntryUseCase {
    pub fn new(repo: Arc<dyn JournalEntryRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, entry_id: String) -> Result<JournalEntryDto, AppError> {
        let id = JournalEntryId(
            Uuid::parse_str(&entry_id)
                .map_err(|e| AppError::Invalid(format!("Invalid entry ID: {}", e)))?
        );

        let original = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("Journal entry not found".into()))?;

        if original.status != JournalEntryStatus::Posted {
            return Err(AppError::Forbidden("يمكن عكس القيود المرحلة فقط".into()));
        }
        if original.reversal_of_entry_id.is_some() {
            return Err(AppError::Forbidden("لا يمكن عكس قيد عكسي".into()));
        }

        let entry_number = self.repo.get_next_entry_number().await?;

        let mut reversal = JournalEntry::create_reversal(
            &original,
            entry_number,
            chrono::Utc::now(),
            format!("عكس قيد {}", original.entry_number),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        reversal.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        let mut original = original;
        original.reverse().map_err(AppError::from)?;

        self.repo.save_reversal_pair(&reversal, &original).await?;

        Ok(JournalEntryDto::from(reversal))
    }
}
