use std::collections::HashMap;
use std::sync::Arc;

use uuid::Uuid;

use crate::dto::journal_entry_dto::JournalEntryDto;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::journal_entry::{JournalEntry, JournalEntryStatus};
use domain::shared::JournalEntryId;

/// Reverses a posted journal entry by posting a true contra entry (debit/credit
/// swapped, typed `Reversal`, linked via `reversal_of_entry_id`) and then
/// marking the original entry `Reversed`. Both rows are persisted atomically
/// through `save_reversal_pair` (single transaction).
pub struct ReverseJournalEntryUseCase {
    repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    pool: Arc<sqlx::SqlitePool>,
}

impl ReverseJournalEntryUseCase {
    pub fn new(
        repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        pool: Arc<sqlx::SqlitePool>,
    ) -> Self {
        Self {
            repo,
            account_repo,
            pool,
        }
    }

    pub async fn execute(&self, entry_id: String) -> Result<JournalEntryDto, AppError> {
        let id = JournalEntryId(
            Uuid::parse_str(&entry_id)
                .map_err(|e| AppError::Invalid(format!("Invalid entry ID: {}", e)))?,
        );

        let original = self
            .repo
            .find_by_id(&id)
            .await?
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
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        reversal
            .post()
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        let mut original = original;
        original.reverse().map_err(AppError::from)?;

        // Snapshot sync: the reversal entry is Posted — apply its line deltas
        let affected_account_ids: Vec<domain::shared::AccountId> = reversal
            .lines
            .iter()
            .map(|l| l.account_id)
            .collect();

        let accounts = self.account_repo.find_by_ids(&affected_account_ids).await?;
        let mut account_map: HashMap<domain::shared::AccountId, _> =
            accounts.into_iter().map(|a| (a.id, a)).collect();

        for line in &reversal.lines {
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

        // Persist reversal pair + account snapshots atomically
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Infrastructure(format!("failed to begin transaction: {e}")))?;

        self.repo.save_reversal_pair_in_tx(&mut tx, &reversal, &original).await?;

        for account in account_map.values() {
            self.account_repo.save_with_tx(&mut tx, account).await?;
        }

        tx.commit()
            .await
            .map_err(|e| AppError::Infrastructure(format!("failed to commit transaction: {e}")))?;

        Ok(JournalEntryDto::from(reversal))
    }
}
