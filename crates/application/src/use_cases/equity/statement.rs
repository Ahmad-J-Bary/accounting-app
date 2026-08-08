use std::sync::Arc;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use domain::accounting::JournalEntryStatus;
use domain::shared::AccountId;

use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::partner_repository::PartnerRepository;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartnerEquityRow {
    pub partner_id: String,
    pub partner_name: String,
    /// Registered capital (master data).
    pub capital_registered: String,
    /// Cumulative balance of the partner's linked capital account in the ledger.
    pub ledger_balance: String,
    /// Cumulative balance of the partner's drawings (contra-equity) account.
    pub drawings: String,
    /// ledger_balance − capital_registered (accumulated profit allocations).
    pub profit_allocated: String,
    /// ledger_balance − drawings (the partner's net equity after owner draws).
    pub total_equity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartnerEquityStatementDto {
    pub rows: Vec<PartnerEquityRow>,
    pub total_capital: String,
    pub total_profit_allocated: String,
    pub total_drawings: String,
    pub total_equity: String,
}

/// Builds the partner equity statement ("بيان شركاء"): registered capital plus
/// the cumulative ledger movement on each partner's linked capital account
/// (initial capital + profit allocations), net of the partner's drawings
/// (contra-equity), shown as the accumulated owner-current position.
pub struct GetPartnerEquityStatementUseCase {
    partner_repo: Arc<dyn PartnerRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl GetPartnerEquityStatementUseCase {
    pub fn new(
        partner_repo: Arc<dyn PartnerRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { partner_repo, journal_repo }
    }

    pub async fn execute(&self) -> Result<PartnerEquityStatementDto, AppError> {
        let partners = self.partner_repo.list_all(false).await?;

        let mut rows = Vec::with_capacity(partners.len());
        let mut total_capital = Decimal::ZERO;
        let mut total_drawings = Decimal::ZERO;
        let mut total_equity = Decimal::ZERO;

        for p in &partners {
            let ledger_balance = match p.linked_account_id {
                Some(account_id) => self.ledger_balance(&account_id).await?,
                None => Decimal::ZERO,
            };
            // Drawings are a debit-normal contra-equity balance; their ledger
            // balance is positive in the direction of drawings.
            let drawings = match p.drawings_account_id {
                Some(account_id) => self.ledger_balance(&account_id).await?,
                None => Decimal::ZERO,
            };
            let capital_registered = p.amount_local;
            let profit_allocated = ledger_balance - capital_registered;
            let total_equity_row = ledger_balance - drawings;

            total_capital += capital_registered;
            total_drawings += drawings;
            total_equity += total_equity_row;

            rows.push(PartnerEquityRow {
                partner_id: p.id.0.to_string(),
                partner_name: p.name.clone(),
                capital_registered: capital_registered.to_string(),
                ledger_balance: ledger_balance.to_string(),
                drawings: drawings.to_string(),
                profit_allocated: profit_allocated.to_string(),
                total_equity: total_equity_row.to_string(),
            });
        }

        Ok(PartnerEquityStatementDto {
            total_capital: total_capital.to_string(),
            total_profit_allocated: (total_capital + total_equity - total_drawings - total_capital)
                .to_string(),
            total_drawings: total_drawings.to_string(),
            total_equity: total_equity.to_string(),
            rows,
        })
    }

    async fn ledger_balance(&self, account_id: &AccountId) -> Result<Decimal, AppError> {
        let entries = self.journal_repo.list_by_account(account_id).await?;
        let mut balance = Decimal::ZERO;
        for entry in &entries {
            if entry.status == JournalEntryStatus::Draft {
                continue;
            }
            for line in &entry.lines {
                if line.account_id == *account_id {
                    balance += line.credit.base_amount - line.debit.base_amount;
                }
            }
        }
        Ok(balance)
    }
}