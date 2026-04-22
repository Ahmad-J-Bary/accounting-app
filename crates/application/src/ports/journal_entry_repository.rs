use async_trait::async_trait;
use domain::accounting::{JournalEntry, JournalEntryId};
use crate::errors::AppError;

#[async_trait]
pub trait JournalEntryRepository: Send + Sync {
    async fn save(&self, entry: &JournalEntry) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError>;
    async fn find_by_number(&self, number: &str) -> Result<Option<JournalEntry>, AppError>;
    async fn list_all(&self) -> Result<Vec<JournalEntry>, AppError>;
    async fn list_by_account(&self, account_id: &domain::shared::AccountId) -> Result<Vec<JournalEntry>, AppError>;
    async fn delete(&self, id: &JournalEntryId) -> Result<(), AppError>;
}
