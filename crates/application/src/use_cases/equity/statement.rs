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
    /// Cumulative balance of the partner's current/profit account: accumulated
    /// profit allocations, kept separate from registered capital (Sec 4 / Sec 13).
    pub current_balance: String,
    /// Cumulative magnitude of the partner's drawings (contra-equity) account,
    /// presented positive and subtracted from capital + current to get equity.
    pub drawings: String,
    /// Accumulated profit allocations: the balance of the partner's current
    /// (profit) account — a real ledger figure, never derived as
    /// "ledger_balance − registered capital" (Sec 13).
    pub profit_allocated: String,
    /// Accumulated loss allocations on the partner's current account (the debit
    /// leg, magnitude). Distinct from `profit_allocated` so a loss period is
    /// shown explicitly and never mixed silently into the profit figure.
    pub loss_allocated: String,
    /// ledger_balance + current_balance − drawings (the partner's net equity).
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
/// the cumulative ledger movement on each partner's linked capital account, the
/// accumulated profit on the partner's current account, net of the partner's
/// drawings (contra-equity), shown as the owner-current position.
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
        let mut total_profit = Decimal::ZERO;
        let mut total_drawings = Decimal::ZERO;
        let mut total_equity = Decimal::ZERO;

        for p in &partners {
            let ledger_balance = match p.linked_account_id {
                Some(account_id) => self.ledger_balance(&account_id).await?,
                None => Decimal::ZERO,
            };
            // Drawings are a debit-normal contra-equity account, so their signed
            // ledger balance is negative. The statement presents the magnitude
            // and SUBTRACTS it: `total_equity = ledger + current - drawings`
            // then reduces equity — a drawing must never inflate it.
            let drawings = match p.drawings_account_id {
                Some(account_id) => self.ledger_balance(&account_id).await?.abs(),
                None => Decimal::ZERO,
            };
            // Accumulated profit allocations live in the partner's CURRENT
            // account, never inside the capital account (Sec 4 / Sec 13).
            let (current_balance, loss_allocated) = match p.current_account_id {
                Some(account_id) => self.ledger_breakdown(&account_id).await?,
                None => (Decimal::ZERO, Decimal::ZERO),
            };
            let capital_registered = p.amount_local;
            let profit_allocated = current_balance;
            let total_equity_row = ledger_balance + current_balance - drawings;

            total_capital += capital_registered;
            total_profit += profit_allocated;
            total_drawings += drawings;
            total_equity += total_equity_row;

            rows.push(PartnerEquityRow {
                partner_id: p.id.0.to_string(),
                partner_name: p.name.clone(),
                capital_registered: capital_registered.to_string(),
                ledger_balance: ledger_balance.to_string(),
                current_balance: current_balance.to_string(),
                drawings: drawings.to_string(),
                profit_allocated: profit_allocated.to_string(),
                loss_allocated: loss_allocated.to_string(),
                total_equity: total_equity_row.to_string(),
            });
        }

        Ok(PartnerEquityStatementDto {
            total_capital: total_capital.to_string(),
            total_profit_allocated: total_profit.to_string(),
            total_drawings: total_drawings.to_string(),
            total_equity: total_equity.to_string(),
            rows,
        })
    }

    async fn ledger_balance(&self, account_id: &AccountId) -> Result<Decimal, AppError> {
        Ok(self.ledger_breakdown(account_id).await?.0)
    }

    /// (net credit−debit balance, debit magnitude) for an account across all
    /// Posted/Reversed journal lines, from the ledgers themselves.
    async fn ledger_breakdown(&self, account_id: &AccountId) -> Result<(Decimal, Decimal), AppError> {
        let entries = self.journal_repo.list_by_account(account_id).await?;
        let mut balance = Decimal::ZERO;
        let mut debits = Decimal::ZERO;
        for entry in &entries {
            if entry.status == JournalEntryStatus::Draft {
                continue;
            }
            for line in &entry.lines {
                if line.account_id == *account_id {
                    balance += line.credit.base_amount - line.debit.base_amount;
                    debits += line.debit.base_amount;
                }
            }
        }
        Ok((balance, debits))
    }
}