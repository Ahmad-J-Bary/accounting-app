use async_trait::async_trait;
use domain::accounting::journal_entry::JournalEntry;
use domain::accounting::OpeningBalanceMigration;
use crate::errors::AppError;

/// Persists an opening-balance posting atomically: the generated journal entry
/// and the migration status change are committed in a single SQLite transaction,
/// so a partial write can never leave the books inconsistent.
#[async_trait]
pub trait OpeningPostingRepository: Send + Sync {
    async fn post(&self, migration: &OpeningBalanceMigration, entry: &JournalEntry) -> Result<(), AppError>;
}