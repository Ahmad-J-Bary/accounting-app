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

    /// Persists an opening-balance cancellation atomically: the generated
    /// reversing journal entry (`reversal` — which already carries
    /// `reversal_of_entry_id` pointing at the aggregate), the ORIGINAL
    /// aggregate journal flipped to `Reversed` (a reversal is a relationship:
    /// type/status/link), and the migration status change (Posted ->
    /// Cancelled) are committed in a single SQLite transaction.
    async fn cancel(
        &self,
        migration: &OpeningBalanceMigration,
        reversal: &JournalEntry,
        original: &JournalEntry,
    ) -> Result<(), AppError>;

    /// Persists the residual reclassification atomically: the journal that
    /// moves the Opening Balance Control (53) balance into the accountant-chosen
    /// classification account plus the `residual_applied_at` timestamp on the
    /// migration are committed in a single SQLite transaction.
    async fn apply_residual(&self, migration: &OpeningBalanceMigration, entry: &JournalEntry) -> Result<(), AppError>;
}