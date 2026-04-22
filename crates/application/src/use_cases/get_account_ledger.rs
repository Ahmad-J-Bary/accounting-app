use std::sync::Arc;
use uuid::Uuid;
use rust_decimal::Decimal;

use domain::shared::AccountId;
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::account_dto::{AccountLedgerDto, AccountLedgerLineDto};

pub struct GetAccountLedgerUseCase {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl GetAccountLedgerUseCase {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { account_repo, journal_repo }
    }

    pub async fn execute(&self, account_id: String) -> Result<AccountLedgerDto, AppError> {
        let id = AccountId(Uuid::parse_str(&account_id).map_err(|e| AppError::Invalid(e.to_string()))?);
        
        let account = self.account_repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("Account not found".into()))?;

        let entries = self.journal_repo.list_by_account(&id).await?;
        
        let mut lines = Vec::new();
        let mut total_debit = Decimal::ZERO;
        let mut total_credit = Decimal::ZERO;
        let mut running_balance = Decimal::ZERO;

        // Sort by date ASC for running balance calculation
        let mut sorted_entries = entries;
        sorted_entries.sort_by(|a, b| a.entry_date.cmp(&b.entry_date));

        for entry in sorted_entries {
            for line in &entry.lines {
                if line.account_id == id {
                    let base_debit = line.base_debit();
                    let base_credit = line.base_credit();
                    
                    total_debit += base_debit;
                    total_credit += base_credit;
                    
                    // Standard accounting balance (Assets/Expenses: Debit - Credit, Liabilities/Equity/Revenue: Credit - Debit)
                    // For ledger, we'll just use a running balance based on account type or simple Debit - Credit
                    running_balance += base_debit - base_credit;

                    lines.push(AccountLedgerLineDto {
                        date: entry.entry_date.to_rfc3339(),
                        journal_id: entry.id.0.to_string(),
                        description: entry.description.clone(),
                        currency: format!("{:?}", line.currency),
                        fx_rate: line.fx_rate.to_string(),
                        debit: line.debit.amount().to_string(),
                        credit: line.credit.amount().to_string(),
                        base_debit: base_debit.to_string(),
                        base_credit: base_credit.to_string(),
                        running_balance: running_balance.to_string(),
                    });
                }
            }
        }

        // Return most recent first
        lines.reverse();

        Ok(AccountLedgerDto {
            account_id: account.id.0.to_string(),
            account_name: account.name_ar.clone(),
            lines,
            total_debit: total_debit.to_string(),
            total_credit: total_credit.to_string(),
            final_balance: running_balance.to_string(),
        })
    }
}
