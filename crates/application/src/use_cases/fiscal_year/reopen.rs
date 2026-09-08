use std::collections::HashMap;
use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::fiscal_year::FiscalYearStatus;
use domain::shared::ids::FiscalYearId;

use super::close::require_permission;
use super::create::to_dto;
use super::types::{FiscalYearDto, ReopenFiscalYearCommand};

pub struct ReopenFiscalYearUseCase {
    year_repo: Arc<dyn FiscalYearRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    pool: Arc<sqlx::SqlitePool>,
}

impl ReopenFiscalYearUseCase {
    pub fn new(
        year_repo: Arc<dyn FiscalYearRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        pool: Arc<sqlx::SqlitePool>,
    ) -> Self {
        Self {
            year_repo,
            journal_repo,
            account_repo,
            pool,
        }
    }

    pub async fn execute(&self, cmd: ReopenFiscalYearCommand) -> Result<FiscalYearDto, AppError> {
        require_permission(&cmd.context, "fiscal_year.reopen")?;

        let fiscal_year_id = cmd
            .fiscal_year_id
            .parse::<FiscalYearId>()
            .map_err(|_| AppError::Invalid("معرف السنة المالية غير صالح".into()))?;

        let Some(mut fiscal_year) = self.year_repo.find_by_id(&fiscal_year_id).await? else {
            return Err(AppError::NotFound("السنة المالية غير موجودة".into()));
        };

        // Handle carry-forward reversal when reopening
        if let Some(cf_entry_id) = &fiscal_year.carry_forward_entry_id {
            // Find successor year — if it's closed, we cannot reopen this year
            let successor = self.find_successor_year(&fiscal_year).await?;
            if successor.status == FiscalYearStatus::Closed {
                return Err(AppError::Invalid(
                    "لا يمكن إعادة فتح السنة المالية لأن السنة المالية التالية مغلقة — أعد فتح السنة المالية التالية أولاً".into(),
                ));
            }

            // Reverse the carry-forward entry if it exists and is Posted
            if let Some(mut cf_entry) = self.journal_repo.find_by_id(cf_entry_id).await? {
                use domain::accounting::journal_entry::JournalEntryStatus;
                if cf_entry.status == JournalEntryStatus::Posted {
                    // Reverse account snapshots: apply OPPOSITE deltas
                    let affected_account_ids: Vec<domain::shared::AccountId> = cf_entry
                        .lines
                        .iter()
                        .map(|l| l.account_id)
                        .collect();
                    let accounts = self.account_repo.find_by_ids(&affected_account_ids).await?;
                    let mut account_map: HashMap<domain::shared::AccountId, _> =
                        accounts.into_iter().map(|a| (a.id, a)).collect();

                    for line in &cf_entry.lines {
                        if let Some(account) = account_map.get_mut(&line.account_id) {
                            // Reverse: credit lines become debits, debit lines become credits
                            if line.debit.base_amount > rust_decimal::Decimal::ZERO {
                                account
                                    .credit(line.debit.base_amount)
                                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                            }
                            if line.credit.base_amount > rust_decimal::Decimal::ZERO {
                                account
                                    .debit(line.credit.base_amount)
                                    .map_err(|e| AppError::Invalid(e.to_string()))?;
                            }
                        }
                    }

                    cf_entry.reverse().map_err(|e| AppError::Invalid(e.to_string()))?;

                    let mut tx = self.pool.begin().await.map_err(|e| {
                        AppError::Infrastructure(format!("failed to begin transaction: {e}"))
                    })?;
                    self.journal_repo
                        .save_with_tx(&mut tx, &cf_entry)
                        .await?;
                    for account in account_map.values() {
                        self.account_repo.save_with_tx(&mut tx, account).await?;
                    }
                    tx.commit().await.map_err(|e| {
                        AppError::Infrastructure(format!("failed to commit transaction: {e}"))
                    })?;
                }
            }

            fiscal_year.carry_forward_entry_id = None;
        }

        fiscal_year.reopen()?;
        self.year_repo.update(&fiscal_year).await?;
        Ok(to_dto(&fiscal_year, None))
    }

    /// Find successor fiscal year (same logic as close use case).
    async fn find_successor_year(
        &self,
        current: &domain::accounting::fiscal_year::FiscalYear,
    ) -> Result<domain::accounting::fiscal_year::FiscalYear, AppError> {
        let all_years = self.year_repo.list().await?;
        if let Some(successor) = all_years.iter().find(|y| {
            y.previous_fiscal_year_id
                .as_ref()
                .map(|id| *id == current.id)
                .unwrap_or(false)
        }) {
            return Ok(successor.clone());
        }

        if let Some(successor) = all_years.iter().find(|y| {
            y.start_date.date_naive() == current.end_date.date_naive()
                || y.start_date.date_naive()
                    == current.end_date.date_naive() + chrono::Duration::days(1)
        }) {
            return Ok(successor.clone());
        }

        Err(AppError::NotFound(
            "لا توجد سنة مالية تالية لإعادة الفتح".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockAccountRepository, MockFiscalYearRepository, MockJournalRepository};
    use chrono::{Duration, Utc};
    use domain::accounting::fiscal_year::FiscalYear;
    use domain::accounting::journal_entry::{JournalEntry, JournalEntryStatus, JournalLine, JournalType};
    use domain::shared::ids::{AccountId, FiscalPeriodId, JournalEntryId};
    use domain::shared::{Currency, ExecutionContext, MonetaryAmount, Money};
    use rust_decimal::Decimal;
    use rust_decimal_macros::dec;

    fn admin_context() -> ExecutionContext {
        ExecutionContext {
            actor_id: Some("admin".into()),
            permission_keys: vec!["fiscal_year.reopen".into()],
            ..ExecutionContext::default()
        }
    }

    fn make_closed_year_with_carry_forward(
        year_repo: &MockFiscalYearRepository,
        journal_repo: &MockJournalRepository,
    ) -> (FiscalYearId, FiscalYearId, JournalEntryId) {
        let start = Utc::now() - Duration::days(365);
        let end = Utc::now() - Duration::days(1);
        let mut year = FiscalYear::new(None, "FY2025".into(), start, end, None).unwrap();
        year.start_closing("admin", "close-op").unwrap();

        // Create carry-forward entry first to get the ID
        let cf_entry_id =
            create_carry_forward_entry(journal_repo, format!("carry_forward:{}", year.id));

        year.finalize_close(
            "admin",
            "close-op",
            FiscalPeriodId::new(),
            Some(JournalEntryId::new()),
            Some(cf_entry_id),
        )
        .unwrap();
        year_repo
            .fiscal_years
            .lock()
            .unwrap()
            .push(year.clone());

        let next_start = end + Duration::days(1);
        let next_end = end + Duration::days(366);
        let next_year =
            FiscalYear::new(None, "FY2026".into(), next_start, next_end, Some(year.id)).unwrap();
        year_repo
            .fiscal_years
            .lock()
            .unwrap()
            .push(next_year.clone());

        (year.id, next_year.id, cf_entry_id)
    }

    fn create_carry_forward_entry(
        journal_repo: &MockJournalRepository,
        source_id: String,
    ) -> JournalEntryId {
        let base = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        let zero = MonetaryAmount::zero(base.clone());
        let amount = MonetaryAmount::new(Money::new(dec!(1000), base.clone()), Decimal::ONE);
        let amount2 = MonetaryAmount::new(Money::new(dec!(1000), base), Decimal::ONE);

        let cash_id = AccountId::new();
        let capital_id = AccountId::new();
        let mut entry = JournalEntry::new(
            "CF-100".into(),
            JournalType::AccountOpeningBalance,
            vec![
                JournalLine::new(cash_id, amount, zero.clone(), "cf debit".into()),
                JournalLine::new(capital_id, zero, amount2, "cf credit".into()),
            ],
            Utc::now(),
            "carry forward".into(),
            Some(source_id),
        )
        .unwrap();
        entry.post().unwrap();
        let entry_id = entry.id;
        journal_repo.entries.lock().unwrap().push(entry);
        entry_id
    }

    #[tokio::test]
    async fn reopen_simple_year_succeeds() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let start = Utc::now() - Duration::days(365);
        let end = Utc::now() - Duration::days(1);
        let mut year = FiscalYear::new(None, "FY2025".into(), start, end, None).unwrap();
        year.start_closing("admin", "close-op").unwrap();
        year.finalize_close(
            "admin",
            "close-op",
            FiscalPeriodId::new(),
            Some(JournalEntryId::new()),
            None,
        )
        .unwrap();
        year_repo
            .fiscal_years
            .lock()
            .unwrap()
            .push(year.clone());

        let account_repo = Arc::new(MockAccountRepository::new());
        let pool = Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap());
        let use_case = ReopenFiscalYearUseCase::new(year_repo.clone(), journal_repo.clone(), account_repo.clone(), pool.clone());
        let cmd = ReopenFiscalYearCommand {
            fiscal_year_id: year.id.to_string(),
            context: admin_context(),
        };

        let result = use_case.execute(cmd).await.unwrap();
        assert_eq!(result.status, "Reopened");
    }

    #[tokio::test]
    async fn reopen_reverses_carry_forward() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, _next_id, cf_entry_id) =
            make_closed_year_with_carry_forward(&year_repo, &journal_repo);

        let account_repo = Arc::new(MockAccountRepository::new());
        let pool = Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap());
        let use_case = ReopenFiscalYearUseCase::new(year_repo.clone(), journal_repo.clone(), account_repo.clone(), pool.clone());
        let cmd = ReopenFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            context: admin_context(),
        };

        let result = use_case.execute(cmd).await.unwrap();
        assert_eq!(result.status, "Reopened");

        let entries = journal_repo.entries.lock().unwrap();
        let cf_entry = entries.iter().find(|e| e.id == cf_entry_id).unwrap();
        assert_eq!(cf_entry.status, JournalEntryStatus::Reversed);

        let fy = year_repo.find_by_id(&year_id).await.unwrap().unwrap();
        assert!(fy.carry_forward_entry_id.is_none());
    }

    #[tokio::test]
    async fn reopen_blocked_if_successor_closed() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, next_id, cf_entry_id) =
            make_closed_year_with_carry_forward(&year_repo, &journal_repo);

        {
            let mut years = year_repo.fiscal_years.lock().unwrap();
            let next = years.iter_mut().find(|y| y.id == next_id).unwrap();
            next.start_closing("admin", "close-next").unwrap();
            next.finalize_close(
                "admin",
                "close-next",
                FiscalPeriodId::new(),
                Some(JournalEntryId::new()),
                None,
            )
            .unwrap();
        }

        let account_repo = Arc::new(MockAccountRepository::new());
        let pool = Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap());
        let use_case = ReopenFiscalYearUseCase::new(year_repo.clone(), journal_repo.clone(), account_repo.clone(), pool.clone());
        let cmd = ReopenFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            context: admin_context(),
        };

        let err = use_case.execute(cmd).await.unwrap_err();
        assert!(
            matches!(err, AppError::Invalid(_)),
            "reopen must fail when successor is closed, got: {:?}",
            err
        );
    }
}
