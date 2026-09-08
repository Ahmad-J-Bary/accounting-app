use std::collections::HashMap;
use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use domain::accounting::journal_entry::JournalEntry;
use domain::shared::AccountId;

/// Applies journal line deltas to account snapshots. This is the core of
/// snapshot synchronization: for each line in the journal, debit the debit
/// account and credit the credit account, updating the running accumulators.
///
/// Call this AFTER `entry.post()` and BEFORE (or inside the same tx as)
/// `journal_repo.save()`.
pub async fn apply_snapshot_deltas(
    account_repo: &Arc<dyn AccountRepository>,
    entry: &JournalEntry,
) -> Result<Vec<domain::accounting::account::Account>, AppError> {
    let affected_account_ids: Vec<AccountId> =
        entry.lines.iter().map(|l| l.account_id).collect();

    let accounts = account_repo.find_by_ids(&affected_account_ids).await?;
    let mut account_map: HashMap<AccountId, _> =
        accounts.into_iter().map(|a| (a.id, a)).collect();

    for line in &entry.lines {
        if let Some(account) = account_map.get_mut(&line.account_id) {
            if line.debit.base_amount > rust_decimal::Decimal::ZERO {
                account
                    .debit(line.debit.base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
            }
            if line.credit.base_amount > rust_decimal::Decimal::ZERO {
                account
                    .credit(line.credit.base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
            }
        }
    }

    Ok(account_map.into_values().collect())
}

/// Saves a posted journal entry and its affected account snapshots atomically.
/// Opens a transaction, inserts the journal, saves all accounts, and commits.
///
/// Use this instead of `journal_repo.save(&entry)` when the entry is Posted
/// and account snapshots must be kept in sync.
pub async fn save_posted_with_snapshots(
    pool: &Arc<sqlx::SqlitePool>,
    journal_repo: &dyn crate::ports::journal_entry_repository::JournalEntryRepository,
    account_repo: &Arc<dyn AccountRepository>,
    entry: &JournalEntry,
) -> Result<(), AppError> {
    let affected_account_ids: Vec<AccountId> =
        entry.lines.iter().map(|l| l.account_id).collect();

    let accounts = account_repo.find_by_ids(&affected_account_ids).await?;
    let mut account_map: HashMap<AccountId, _> =
        accounts.into_iter().map(|a| (a.id, a)).collect();

    for line in &entry.lines {
        if let Some(account) = account_map.get_mut(&line.account_id) {
            if line.debit.base_amount > rust_decimal::Decimal::ZERO {
                account
                    .debit(line.debit.base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
            }
            if line.credit.base_amount > rust_decimal::Decimal::ZERO {
                account
                    .credit(line.credit.base_amount)
                    .map_err(|e| AppError::Invalid(e.to_string()))?;
            }
        }
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(format!("failed to begin transaction: {e}")))?;

    journal_repo.save_with_tx(&mut tx, entry).await?;

    for account in account_map.values() {
        account_repo.save_with_tx(&mut tx, account).await?;
    }

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(format!("failed to commit transaction: {e}")))?;

    Ok(())
}
