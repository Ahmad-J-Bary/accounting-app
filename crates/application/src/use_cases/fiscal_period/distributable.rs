use std::sync::Arc;

use rust_decimal::Decimal;

use domain::accounting::account::AccountPurpose;
use domain::accounting::JournalEntryStatus;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::{JournalEntryRepository, ReversalScope};
use crate::use_cases::fiscal_period::types::{
    DistributableProfitDto, AUTH_ALLOCATION_SOURCE_PREFIX,
};

/// Computes the distributable profit for a window (Sec 18 / Sec 22):
///
///   distributable = current_period_profit + retained_earnings
///
/// * `current_period_profit` — ledger net profit over the window (posted
///   journals, revenue − expenses).
/// * `retained_earnings_balance` — balance of the retained-earnings account
///   (purpose `RetainedEarnings`), i.e. historical/accumulated result.
///
/// A distribution debits retained earnings, so the retained account ALREADY
/// nets every posted `profit_distribution:{...}` event: the result is the
/// amount still available (remaining), and partial distributions shrink it
/// correctly. `allocated_to_date` is exposed separately as a DISPLAY-only
/// figure («المُوزَّع سابقاً») — it must NOT be subtracted again.
///
/// This is a READ-ONLY projection: it never posts, allocates or creates
/// anything. Allocation remains a separate command (Sec 22).
pub struct GetDistributableProfitUseCase {
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl GetDistributableProfitUseCase {
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
        period_start: String,
        period_end: String,
    ) -> Result<DistributableProfitDto, AppError> {
        let from = crate::use_cases::fiscal_period::net_profit::parse_period_bound(&period_start)?;
        let to = crate::use_cases::fiscal_period::net_profit::parse_period_bound(&period_end)?;

        let accounts = self.account_repo.list_all().await?;
        // The POSTED-LEDGER policy (see `ReversalScope`): only Posted entries
        // with no reversal relationship feed the distributable-profit window.
        let period_entries = self
            .journal_repo
            .list_with_filters(
                Some(from),
                Some(to),
                None,
                None,
                None,
                Some(JournalEntryStatus::Posted),
                ReversalScope::PostedLedger,
            )
            .await?;

        let totals = crate::use_cases::opening_balance::net_profit::compute_ledger_totals(
            &accounts,
            &period_entries,
        );

        // Retained earnings balance: the retained-earnings (52) account balance
        // derived from the ledger, NOT the stored/registered balance.
        //
        // IMPORTANT: Retained earnings is a cumulative equity account. Its
        // balance may include entries from BEFORE the period window (e.g.,
        // opening balance migration posted earlier). We must compute it from
        // ALL posted entries up to the period end, not just from entries
        // within the window.
        let all_entries = self
            .journal_repo
            .list_with_filters(
                None,
                Some(to),
                None,
                None,
                None,
                Some(JournalEntryStatus::Posted),
                ReversalScope::PostedLedger,
            )
            .await?;
        let retained = retained_earnings_balance(&accounts, &all_entries);

        // Allocated-to-date = sum of profit_distribution source journals posted
        // for the window. `find_all_by_source_id` prefix not supported, so we
        // scan the window's posted entries by their source prefix instead.
        let mut allocated = Decimal::ZERO;
        for entry in &period_entries {
            if let Some(source_id) = &entry.source_id {
                if source_id.starts_with(AUTH_ALLOCATION_SOURCE_PREFIX) {
                    allocated += entry.total_base_debit();
                }
            }
        }

        let current_period_profit = totals.net.round_dp(2);
        let distributable = current_period_profit + retained;

        Ok(DistributableProfitDto {
            period_id: None,
            current_period_profit: current_period_profit.to_string(),
            retained_earnings_balance: retained.round_dp(2).to_string(),
            allocated_to_date: allocated.round_dp(2).to_string(),
            distributable: distributable.round_dp(2).to_string(),
        })
    }
}

/// Balance of the retained-earnings (purpose `RetainedEarnings`) accounts
/// derived from the posted ledger. `pub(crate)` so `AllocateNetProfitUseCase`
/// guards its distribution cap with the exact same figure.
pub(crate) fn retained_earnings_balance(
    accounts: &[domain::accounting::account::Account],
    entries: &[domain::accounting::JournalEntry],
) -> Decimal {
    let by_id: std::collections::HashMap<_, _> = accounts
        .iter()
        .map(|a| (&a.id, a))
        .filter(|(_, a)| a.purpose == AccountPurpose::RetainedEarnings)
        .collect();

    let mut balance = Decimal::ZERO;
    for entry in entries {
        if entry.status != JournalEntryStatus::Posted {
            continue;
        }
        for line in &entry.lines {
            if by_id.contains_key(&line.account_id) {
                // Credit-normal account: balance = credit − debit.
                balance += line.credit.base_amount - line.debit.base_amount;
            }
        }
    }
    balance
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::account::{Account, AccountCategory, AccountType};
    use domain::accounting::journal_entry::{JournalLine as TestJournalLine, JournalType};
    use domain::shared::{AccountId, Currency, MonetaryAmount};

    fn test_currency() -> Currency {
        Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false)
    }

    fn account(code: &str, purpose: AccountPurpose) -> Account {
        Account::new(
            code.to_string(),
            format!("account {code}"),
            format!("account {code}"),
            AccountType::Equity,
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
        .with_purpose(purpose)
    }

    fn posted_entry_with_source(
        account_id: AccountId,
        debit: i64,
        credit: i64,
        source_id: Option<String>,
    ) -> domain::accounting::JournalEntry {
        let mut entry = domain::accounting::JournalEntry::new(
            format!("JE-{}", uuid::Uuid::new_v4()),
            JournalType::GeneralJournal,
            vec![TestJournalLine::new(
                account_id,
                MonetaryAmount::from_base(Decimal::new(debit, 0), test_currency()),
                MonetaryAmount::from_base(Decimal::new(credit, 0), test_currency()),
                "test".into(),
            )],
            chrono::Utc::now(),
            "test".into(),
            source_id,
        )
        .unwrap();
        entry.status = JournalEntryStatus::Posted;
        entry
    }

    fn posted_entry(
        account_id: AccountId,
        debit: i64,
        credit: i64,
    ) -> domain::accounting::JournalEntry {
        posted_entry_with_source(account_id, debit, credit, None)
    }

    #[test]
    fn retained_earnings_balance_is_credit_normal() {
        let retained = account("5201", AccountPurpose::RetainedEarnings);
        let other = account("3101", AccountPurpose::PartnerCapital);
        let entries = vec![
            // +500 retained (credit)
            posted_entry(retained.id, 0, 500),
            // +200 debit against retained — reduces balance to 300
            posted_entry(retained.id, 200, 0),
            // non-retained accounts are ignored
            posted_entry(other.id, 0, 999),
        ];
        assert_eq!(
            retained_earnings_balance(&[retained, other], &entries),
            Decimal::new(300, 0)
        );
    }

    #[test]
    fn retained_earnings_ignores_non_posted() {
        let retained = account("5201", AccountPurpose::RetainedEarnings);
        let mut entry = posted_entry(retained.id, 0, 500);
        entry.status = JournalEntryStatus::Draft;
        assert_eq!(
            retained_earnings_balance(&[retained], &[entry]),
            Decimal::ZERO
        );
    }

    #[test]
    fn retained_earnings_includes_entries_outside_window() {
        let retained = account("5201", AccountPurpose::RetainedEarnings);
        // Entry from before the period window (e.g., opening balance migration)
        let old_entry = posted_entry(retained.id, 0, 1000);
        // Entry within the current period
        let new_entry = posted_entry(retained.id, 0, 500);
        // A distribution that debited retained earnings
        let distribution =
            posted_entry_with_source(retained.id, 200, 0, Some("profit_distribution:prev".into()));
        let all_entries = vec![old_entry, new_entry, distribution];
        // retained_earnings_balance must include ALL posted entries: 1000 + 500 - 200 = 1300
        assert_eq!(
            retained_earnings_balance(&[retained], &all_entries),
            Decimal::new(1300, 0)
        );
    }
}
