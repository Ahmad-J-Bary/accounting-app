use std::sync::Arc;

use chrono::{DateTime, Utc};
use domain::accounting::{JournalEntry, JournalEntryStatus};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::use_cases::fiscal_period::types::{ComputedPeriodProfitDto, ComputePeriodProfitCommand};

/// Computes net profit for an explicit accounting window (Sec 19 / Sec 20) —
/// NOT derived from any opening migration. The ledger (posted journals) is the
/// sole source of truth:
///
///   revenue  = Σ over Revenue-typed lines of (credit − debit)
///   expenses = Σ over Expenses-typed lines of (debit − credit)
///   net      = revenue − expenses
///
/// Reversals net automatically (a reversal carries swapped legs); draft entries
/// and partner drawings are excluded by `compute_ledger_totals`.
pub struct ComputePeriodNetProfitUseCase {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl ComputePeriodNetProfitUseCase {
    pub fn new(
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(
        &self,
        cmd: ComputePeriodProfitCommand,
    ) -> Result<ComputedPeriodProfitDto, AppError> {
        let from = parse_period_bound(&cmd.period_start)?;
        let to = parse_period_bound(&cmd.period_end)?;
        if from > to {
            return Err(AppError::Invalid(
                "بداية الفترة المالية يجب أن تسبق نهايتها".into(),
            ));
        }

        let entries = self
            .journal_repo
            .list_with_filters(
                Some(from),
                Some(to),
                None,
                None,
                None,
                Some(JournalEntryStatus::Posted),
            )
            .await?;

        let accounts = self.account_repo.list_all().await?;
        let totals = crate::use_cases::opening_balance::net_profit::compute_ledger_totals(&accounts, &entries);

        Ok(ComputedPeriodProfitDto {
            net_profit: totals.net.round_dp(2).to_string(),
            total_revenue: totals.revenue.round_dp(2).to_string(),
            total_expenses: totals.expenses.round_dp(2).to_string(),
            entry_count: entries.len() as i64,
        })
    }
}

/// Parses an RFC-3339 accounting date bound to `UTC`. Shared across the module.
pub fn parse_period_bound(s: &str) -> Result<DateTime<Utc>, AppError> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|_| AppError::Invalid("تاريخ غير صالح (RFC3339)".into()))
}

/// Shared pure aggregator exposed for the fiscal-period module to reference.
/// Keyed on explicit accounting dates only — never on an opening migration.
pub fn period_ledger_totals(
    accounts: &[domain::accounting::account::Account],
    entries: &[JournalEntry],
) -> crate::use_cases::opening_balance::net_profit::LedgerTotals {
    crate::use_cases::opening_balance::net_profit::compute_ledger_totals(accounts, entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::account::{Account, AccountCategory, AccountType};
    use domain::accounting::journal_entry::{JournalLine as TestJournalLine, JournalType};
    use domain::shared::{AccountId, Currency, MonetaryAmount};
    use rust_decimal::{Decimal, RoundingStrategy};

    fn test_currency() -> Currency {
        Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false)
    }

    fn account(code: &str, account_type: AccountType) -> Account {
        Account::new(
            code.to_string(),
            format!("account {code}"),
            format!("account {code}"),
            account_type,
            None,
            AccountCategory::Detail,
            1,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            test_currency(),
            Decimal::ONE,
            None,
        )
        .unwrap()
    }

    fn posted_entry(account_id: AccountId, debit: i64, credit: i64) -> JournalEntry {
        let mut entry = JournalEntry::new(
            format!("JE-{}", uuid::Uuid::new_v4()),
            JournalType::GeneralJournal,
            vec![TestJournalLine::new(
                account_id,
                MonetaryAmount::from_base(Decimal::new(debit, 0), test_currency()),
                MonetaryAmount::from_base(Decimal::new(credit, 0), test_currency()),
                "test".into(),
            )],
            Utc::now(),
            "test".into(),
            None,
        )
        .unwrap();
        entry.status = JournalEntryStatus::Posted;
        entry
    }

    #[test]
    fn explicit_window_totals_as_expected() {
        let rev = account("4001", AccountType::Revenue);
        let exp = account("5001", AccountType::Expenses);
        let totals = period_ledger_totals(&[rev.clone(), exp.clone()], &[
            posted_entry(rev.id, 0, 1000),
            posted_entry(exp.id, 400, 0),
        ]);
        assert_eq!(totals.revenue, Decimal::new(1000, 0));
        assert_eq!(totals.expenses, Decimal::new(400, 0));
        assert_eq!(totals.net.round_dp(2).round_dp_with_strategy(2, RoundingStrategy::ToZero), Decimal::new(600, 0));
    }

    #[test]
    fn drawings_are_never_pnl() {
        let rev = account("4001", AccountType::Revenue);
        let drawings = account("4401", AccountType::Equity)
            .with_purpose(domain::accounting::account::AccountPurpose::PartnerDrawings);
        let totals = period_ledger_totals(&[rev.clone(), drawings.clone()], &[
            posted_entry(rev.id, 0, 1000),
            posted_entry(drawings.id, 250, 0),
        ]);
        assert_eq!(totals.expenses, Decimal::ZERO);
        assert_eq!(totals.net, Decimal::new(1000, 0));
    }

    #[test]
    fn draft_entries_excluded_from_period() {
        let rev = account("4001", AccountType::Revenue);
        let mut entry = posted_entry(rev.id, 0, 1000);
        entry.status = JournalEntryStatus::Draft;
        let totals = period_ledger_totals(&[rev], &[entry]);
        assert_eq!(totals.net, Decimal::ZERO);
    }

    #[test]
    fn parse_period_bound_parses_utc() {
        let dt = parse_period_bound("2026-01-01T00:00:00Z").unwrap();
        assert_eq!(dt, DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z").unwrap().with_timezone(&Utc));
    }

    #[test]
    fn parse_period_bound_rejects_garbage() {
        assert!(parse_period_bound("not-a-date").is_err());
        assert!(parse_period_bound("").is_err());
    }
}