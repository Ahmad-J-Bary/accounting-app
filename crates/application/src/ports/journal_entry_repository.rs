use domain::accounting::{JournalEntry, JournalEntryId, JournalType};
use domain::shared::AccountId;
use chrono::{DateTime, Utc};
use crate::errors::AppError;
use async_trait::async_trait;

#[async_trait]
pub trait JournalEntryRepository: Send + Sync {
    async fn save(&self, entry: &JournalEntry) -> Result<(), AppError>;
    /// Persist a reversal and its reversed original in a single transaction so
    /// the pair can never be partially written.
    async fn save_reversal_pair(
        &self,
        reversal: &JournalEntry,
        original: &JournalEntry,
    ) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError>;
    async fn find_by_number(&self, number: &str) -> Result<Option<JournalEntry>, AppError>;
    async fn list_all(&self) -> Result<Vec<JournalEntry>, AppError>;
    async fn list_by_account(&self, account_id: &AccountId) -> Result<Vec<JournalEntry>, AppError>;
    async fn list_by_accounts(&self, account_ids: &[AccountId]) -> Result<Vec<JournalEntry>, AppError>;
    async fn list_with_filters(
        &self,
        from_date: Option<DateTime<Utc>>,
        to_date: Option<DateTime<Utc>>,
        journal_type: Option<JournalType>,
        account_id: Option<AccountId>,
        partner_id: Option<uuid::Uuid>,
        status: Option<domain::accounting::JournalEntryStatus>,
        exclude_reversal_pairs: bool,
    ) -> Result<Vec<JournalEntry>, AppError>;
    async fn get_next_entry_number(&self) -> Result<String, AppError>;
    async fn find_by_source_id(&self, source_id: &str) -> Result<Option<JournalEntry>, AppError>;
    async fn find_all_by_source_id(&self, source_id: &str) -> Result<Vec<JournalEntry>, AppError>;
    async fn delete(&self, id: &JournalEntryId) -> Result<(), AppError>;
}
