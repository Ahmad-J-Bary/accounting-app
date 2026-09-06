use crate::errors::AppError;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::accounting::{JournalEntry, JournalEntryId, JournalType};
use domain::shared::AccountId;
use rust_decimal::Decimal;

/**
 * How a journal listing relates to REVERSAL PAIRS. Reports must name this
 * policy explicitly (PHASE 3) instead of passing a generic boolean around —
 * a reversal is a relationship, never a type, and each report decides for
 * itself whether either side may appear.
 */
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReversalScope {
    /// Full register: Reversed originals and their Posted contra journals are
    /// kept. Used by the management / daily-journal list which feeds the
    /// client-side official-vs-audit partition.
    All,
    /// The POSTED-LEDGER policy: Posted entries with no reversal relationship.
    /// Neither side of a reversal pair may reach a ledger or a financial
    /// statement (General Ledger, Trial Balance, Balance Sheet, net profit).
    PostedLedger,
}

/// Aggregated debit/credit totals for one account across all qualifying
/// (posted, non-reversed) journal lines.
#[derive(Debug, Clone)]
pub struct AccountAggregationRow {
    pub account_id: AccountId,
    pub total_debit_base: Decimal,
    pub total_credit_base: Decimal,
}

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
    async fn list_by_accounts(
        &self,
        account_ids: &[AccountId],
    ) -> Result<Vec<JournalEntry>, AppError>;
    #[allow(clippy::too_many_arguments)]
    async fn list_with_filters(
        &self,
        from_date: Option<DateTime<Utc>>,
        to_date: Option<DateTime<Utc>>,
        journal_type: Option<JournalType>,
        account_id: Option<AccountId>,
        partner_id: Option<uuid::Uuid>,
        status: Option<domain::accounting::JournalEntryStatus>,
        reversal_scope: ReversalScope,
    ) -> Result<Vec<JournalEntry>, AppError>;
    /// SQL-level aggregation: SUM(debit_base), SUM(credit_base) GROUP BY
    /// account_id for all posted, non-reversed journal lines.
    async fn aggregate_by_account(&self) -> Result<Vec<AccountAggregationRow>, AppError>;
    async fn get_next_entry_number(&self) -> Result<String, AppError>;
    async fn find_by_source_id(&self, source_id: &str) -> Result<Option<JournalEntry>, AppError>;
    async fn find_all_by_source_id(&self, source_id: &str) -> Result<Vec<JournalEntry>, AppError>;
    async fn delete(&self, id: &JournalEntryId) -> Result<(), AppError>;
}
