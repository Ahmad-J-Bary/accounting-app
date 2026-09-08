use std::collections::HashMap;
use std::sync::Arc;

use uuid::Uuid;

use crate::dto::journal_entry_dto::JournalEntryDto;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::use_cases::shared::fiscal_lifecycle::FiscalLifecyclePolicy;
use domain::shared::{AccountId, JournalEntryId};

pub struct PostJournalEntryUseCase {
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    fiscal_year_repo: Arc<dyn FiscalYearRepository>,
    fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
    pool: Arc<sqlx::SqlitePool>,
}

impl PostJournalEntryUseCase {
    pub fn new(
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        fiscal_year_repo: Arc<dyn FiscalYearRepository>,
        fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
        pool: Arc<sqlx::SqlitePool>,
    ) -> Self {
        Self {
            journal_repo,
            account_repo,
            fiscal_year_repo,
            fiscal_period_repo,
            pool,
        }
    }

    pub async fn execute(&self, entry_id: String) -> Result<JournalEntryDto, AppError> {
        let id = JournalEntryId(
            Uuid::parse_str(&entry_id)
                .map_err(|e| AppError::Invalid(format!("Invalid entry ID: {}", e)))?,
        );

        let mut entry = self
            .journal_repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| AppError::NotFound("Journal entry not found".into()))?;

        FiscalLifecyclePolicy::new(
            self.fiscal_year_repo.clone(),
            self.fiscal_period_repo.clone(),
        )
        .validate_normal_operational(None, entry.entry_date)
        .await?;

        entry.post().map_err(AppError::from)?;

        // Snapshot sync: collect affected accounts and apply journal line deltas
        let affected_account_ids: Vec<AccountId> = entry
            .lines
            .iter()
            .map(|l| l.account_id)
            .collect();

        let accounts = self.account_repo.find_by_ids(&affected_account_ids).await?;
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

        // Persist journal + account snapshots atomically
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Infrastructure(format!("failed to begin transaction: {e}")))?;

        self.journal_repo.save_with_tx(&mut tx, &entry).await?;

        for account in account_map.values() {
            self.account_repo.save_with_tx(&mut tx, account).await?;
        }

        tx.commit()
            .await
            .map_err(|e| AppError::Infrastructure(format!("failed to commit transaction: {e}")))?;

        Ok(JournalEntryDto::from(entry))
    }
}
