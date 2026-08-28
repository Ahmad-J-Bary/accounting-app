use std::sync::Arc;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use domain::accounting::JournalEntryStatus;
use domain::accounting::partner::ProfitSharingType;
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
    /// Partner's capital ratio as a percentage of total registered capital.
    pub capital_ratio: String,
    /// Effective profit-sharing ratio (Manual / BasedOnCapitalLocal / BasedOnCapitalOriginal).
    pub profit_share_ratio: String,
    /// Current account balance before `from_date` (accumulated profit from prior periods).
    pub accumulated_profit_prior: String,
    /// Drawings balance before `from_date` (accumulated drawings from prior periods).
    pub accumulated_drawings_prior: String,
    /// Net movement on the current account within [from_date, to_date].
    pub period_profit: String,
    /// Drawings magnitude within [from_date, to_date].
    pub period_drawings: String,
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
///
/// When `from_date` / `to_date` are provided, the statement also computes:
/// - Period-specific profit and drawings (within the date range)
/// - Accumulated profit/drawings from prior periods (before from_date)
/// - Capital ratio and effective profit-sharing ratio
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

    pub async fn execute(
        &self,
        from_date: Option<DateTime<Utc>>,
        to_date: Option<DateTime<Utc>>,
    ) -> Result<PartnerEquityStatementDto, AppError> {
        let partners = self.partner_repo.list_all(false).await?;

        // Pre-compute total capital for ratio calculation
        let total_capital: Decimal = partners.iter().map(|p| p.amount_local).sum();
        let total_original_capital: Decimal = partners.iter().map(|p| p.amount_original).sum();

        let mut rows = Vec::with_capacity(partners.len());
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

            // Compute capital ratio
            let capital_ratio = if total_capital > Decimal::ZERO {
                (capital_registered / total_capital * Decimal::new(100, 0))
                    .round_dp(2)
            } else {
                Decimal::ZERO
            };

            // Compute effective profit-sharing ratio
            let original_ratio = if total_original_capital > Decimal::ZERO {
                (p.amount_original / total_original_capital * Decimal::new(100, 0))
                    .round_dp(2)
            } else {
                Decimal::ZERO
            };
            let profit_share_ratio = match p.profit_sharing_type {
                ProfitSharingType::Manual => {
                    p.profit_sharing_ratio.unwrap_or(Decimal::ZERO)
                }
                ProfitSharingType::BasedOnCapitalLocal => capital_ratio,
                ProfitSharingType::BasedOnCapitalOriginal => original_ratio,
            };

            // Period-specific breakdown when date filters are provided
            let (accumulated_profit_prior, accumulated_drawings_prior,
                 period_profit, period_drawings) = if let (Some(from), Some(to)) = (from_date, to_date) {
                let current_breakdown = match p.current_account_id {
                    Some(account_id) => {
                        self.ledger_breakdown_ranged(&account_id, from, to).await?
                    }
                    None => (Decimal::ZERO, Decimal::ZERO, Decimal::ZERO),
                };
                let drawings_breakdown = match p.drawings_account_id {
                    Some(account_id) => {
                        self.drawings_breakdown_ranged(&account_id, from, to).await?
                    }
                    None => (Decimal::ZERO, Decimal::ZERO),
                };
                (
                    current_breakdown.1,  // prior credit balance
                    drawings_breakdown.1, // prior debit magnitude
                    current_breakdown.0,  // period net (credit - debit)
                    drawings_breakdown.0, // period debit magnitude
                )
            } else {
                (Decimal::ZERO, Decimal::ZERO, Decimal::ZERO, Decimal::ZERO)
            };

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
                capital_ratio: capital_ratio.to_string(),
                profit_share_ratio: profit_share_ratio.to_string(),
                accumulated_profit_prior: accumulated_profit_prior.to_string(),
                accumulated_drawings_prior: accumulated_drawings_prior.to_string(),
                period_profit: period_profit.to_string(),
                period_drawings: period_drawings.to_string(),
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
    /// Posted journal lines only, from the ledgers themselves.
    async fn ledger_breakdown(&self, account_id: &AccountId) -> Result<(Decimal, Decimal), AppError> {
        let entries = self.journal_repo.list_by_account(account_id).await?;
        let mut balance = Decimal::ZERO;
        let mut debits = Decimal::ZERO;
        for entry in &entries {
            if entry.status != JournalEntryStatus::Posted {
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

    /// Period breakdown for the current/profit account:
    /// (period_net, prior_credit_balance, _unused)
    /// where period_net = credit - debit within [from, to].
    async fn ledger_breakdown_ranged(
        &self,
        account_id: &AccountId,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<(Decimal, Decimal, Decimal), AppError> {
        let entries = self.journal_repo.list_by_account(account_id).await?;
        let mut period_net = Decimal::ZERO;
        let mut prior_balance = Decimal::ZERO;
        for entry in &entries {
            if entry.status != JournalEntryStatus::Posted {
                continue;
            }
            for line in &entry.lines {
                if line.account_id == *account_id {
                    let line_date = entry.entry_date;
                    let net = line.credit.base_amount - line.debit.base_amount;
                    if line_date < from {
                        prior_balance += net;
                    } else if line_date <= to {
                        period_net += net;
                    }
                }
            }
        }
        Ok((period_net, prior_balance, Decimal::ZERO))
    }

    /// Period breakdown for the drawings account (debit-normal contra-equity):
    /// (period_debit_magnitude, prior_debit_magnitude)
    async fn drawings_breakdown_ranged(
        &self,
        account_id: &AccountId,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<(Decimal, Decimal), AppError> {
        let entries = self.journal_repo.list_by_account(account_id).await?;
        let mut period_debits = Decimal::ZERO;
        let mut prior_debits = Decimal::ZERO;
        for entry in &entries {
            if entry.status != JournalEntryStatus::Posted {
                continue;
            }
            for line in &entry.lines {
                if line.account_id == *account_id {
                    let debit = line.debit.base_amount;
                    if entry.entry_date < from {
                        prior_debits += debit;
                    } else if entry.entry_date <= to {
                        period_debits += debit;
                    }
                }
            }
        }
        Ok((period_debits, prior_debits))
    }
}
