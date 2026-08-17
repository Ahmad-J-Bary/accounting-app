use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

use domain::accounting::account::{Account, AccountType};
use domain::accounting::{JournalEntry, JournalEntryStatus};
use domain::shared::AccountId;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::{ComputedNetProfitDto, ComputeNetProfitCommand};

/// Computes the net profit figure for the cutover from the *posted* journal
/// ledger up to (and including) the migration's cutover date. This is the
/// source of truth that `AllocateNetProfitUseCase` can feed automatically
/// instead of asking the user to type the number manually.
///
/// The contribution of each journal line is derived from its account type:
///   revenue  = Σ over Revenue-typed lines of (credit − debit)
///   expenses = Σ over Expenses-typed lines of (debit − credit)
///   net_profit = revenue − expenses
///
/// Only `JournalEntryStatus::Posted` entries are considered so draft entries
/// and un-posted migration lines never leak in. Reversals net automatically
/// because a reversal carries swapped debits/credits.
pub struct ComputeNetProfitUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl ComputeNetProfitUseCase {
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            migration_repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, cmd: ComputeNetProfitCommand) -> Result<ComputedNetProfitDto, AppError> {
        let migration = self.migration_repo.find_by_id(&cmd.migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        // An explicit period window wins over the migration's cutover date, so
        // net profit can be computed for any fiscal period (Sec 45). Without it
        // the window defaults to everything up to cutover end-of-day.
        let (from, to) = parse_period(cmd.period_start.as_deref(), cmd.period_end.as_deref())
            .unwrap_or((None, Some(cutover_end_of_day(migration.cutover_date))));

        let entries = self.journal_repo
            .list_with_filters(
                from,
                to,
                None,
                None,
                None,
                Some(JournalEntryStatus::Posted),
                false,
            )
            .await?;

        let accounts = self.account_repo.list_all().await?;
        let totals = compute_ledger_totals(&accounts, &entries);

        Ok(ComputedNetProfitDto {
            net_profit: totals.net.round_dp(2),
            total_revenue: totals.revenue.round_dp(2),
            total_expenses: totals.expenses.round_dp(2),
            entry_count: entries.len() as i64,
        })
    }
}

/// Inclusive start/end bounds for the net-profit ledger window.
type PeriodBounds = (Option<DateTime<Utc>>, Option<DateTime<Utc>>);

/// Parses an explicit `period_start` / `period_end` pair into filter bounds.
/// Both must be present and ISO-8601 parseable; otherwise `None` is returned so
/// the caller falls back to the cutover window.
fn parse_period(start: Option<&str>, end: Option<&str>) -> Option<PeriodBounds> {
    let (Some(start), Some(end)) = (start, end) else { return None };
    let start_dt = DateTime::parse_from_rfc3339(start).ok()?;
    let end_dt = DateTime::parse_from_rfc3339(end).ok()?;
    Some((Some(start_dt.with_timezone(&Utc)), Some(end_dt.with_timezone(&Utc))))
}

/// Inclusive end-of-day bound so posted entries dated on the cutover day itself
/// are part of the ledger window.
fn cutover_end_of_day(cutover_date: DateTime<Utc>) -> DateTime<Utc> {
    let day = cutover_date.date_naive();
    let end = day.and_hms_opt(23, 59, 59).expect("valid time");
    DateTime::<Utc>::from_naive_utc_and_offset(end, Utc)
}

pub struct LedgerTotals {
    pub revenue: Decimal,
    pub expenses: Decimal,
    pub net: Decimal,
}

/// Pure aggregation over posted journal entries and the chart of accounts.
/// Exposed as a free function so the summation semantics can be tested without
/// I/O. Lines referencing accounts absent from the chart are skipped.
pub fn compute_ledger_totals(accounts: &[Account], entries: &[JournalEntry]) -> LedgerTotals {
    let by_id: HashMap<&AccountId, &Account> = accounts.iter().map(|a| (&a.id, a)).collect();

    let mut revenue = Decimal::ZERO;
    let mut expenses = Decimal::ZERO;

    for entry in entries {
        if entry.status != JournalEntryStatus::Posted {
            continue;
        }
        for line in &entry.lines {
            let account = match by_id.get(&line.account_id) {
                Some(a) => *a,
                None => continue,
            };
            // Partner drawings (owner current) are contra-equity, NEVER a P&L
            // expense (Sec 11 / Sec 31). Reclassifying them as Equity + explicit
            // guard keeps them out of net profit both in the legacy migration
            // ledger and after partner-drawings journals are posted.
            if account.is_drawings_account() {
                continue;
            }
            match account.account_type {
                AccountType::Revenue => revenue += line.base_credit() - line.base_debit(),
                AccountType::Expenses => expenses += line.base_debit() - line.base_credit(),
                _ => {}
            }
        }
    }

    LedgerTotals {
        revenue,
        expenses,
        net: revenue - expenses,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::account::AccountCategory;
    use domain::accounting::journal_entry::JournalLine as TestJournalLine;
    use domain::shared::{Currency, MonetaryAmount};
    use rust_decimal_macros::dec;
    use uuid::Uuid;

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
            Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false),
            Decimal::ONE,
            None,
        )
        .unwrap()
    }

    fn posted_entry(
        account_id: AccountId,
        debit: i64,
        credit: i64,
    ) -> JournalEntry {
        let cur = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
        let mut entry = JournalEntry::new(
            format!("JE-{}-{debit}-{credit}", uuid_gen()),
            domain::accounting::JournalType::GeneralJournal,
            vec![TestJournalLine::new(
                account_id,
                MonetaryAmount::from_base(Decimal::new(debit, 0), cur.clone()),
                MonetaryAmount::from_base(Decimal::new(credit, 0), cur),
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

    fn uuid_gen() -> String {
        Uuid::new_v4().to_string()
    }

    #[test]
    fn revenue_and_expenses_are_separated() {
        let rev = account("4001", AccountType::Revenue);
        let exp = account("5001", AccountType::Expenses);
        let totals = compute_ledger_totals(&[rev.clone(), exp.clone()], &[
            posted_entry(rev.id, 0, 1000),
            posted_entry(exp.id, 300, 0),
        ]);
        assert_eq!(totals.revenue, dec!(1000));
        assert_eq!(totals.expenses, dec!(300));
        assert_eq!(totals.net, dec!(700));
    }

    #[test]
    fn draft_entries_are_excluded() {
        let rev = account("4001", AccountType::Revenue);
        let mut entry = posted_entry(rev.id, 0, 1000);
        entry.status = JournalEntryStatus::Draft;
        let totals = compute_ledger_totals(&[rev], &[entry]);
        assert_eq!(totals.net, Decimal::ZERO);
    }

    #[test]
    fn reversal_nets_the_original_automatically() {
        let rev = account("4001", AccountType::Revenue);
        let original = posted_entry(rev.id, 0, 1000);
        let mut reversal = posted_entry(rev.id, 1000, 0); // contra
        reversal.status = JournalEntryStatus::Posted;
        let totals = compute_ledger_totals(&[rev], &[original, reversal]);
        assert_eq!(totals.net, Decimal::ZERO);
    }

    #[test]
    fn unknown_account_lines_are_skipped() {
        let rev = account("4001", AccountType::Revenue);
        let ghost = AccountId(Uuid::new_v4());
        let entry = posted_entry(ghost, 0, 999);
        let totals = compute_ledger_totals(&[rev], &[entry]);
        assert_eq!(totals.net, Decimal::ZERO);
    }

    #[test]
    fn partner_drawings_do_not_reduce_net_profit() {
        let rev = account("4001", AccountType::Revenue);
        // After migration 143 the partner drawings account (44X) is Equity.
        let drawings = account("4401", AccountType::Equity);
        let totals = compute_ledger_totals(&[rev.clone(), drawings.clone()], &[
            posted_entry(rev.id, 0, 1000),
            posted_entry(drawings.id, 250, 0),
        ]);
        assert_eq!(totals.expenses, Decimal::ZERO);
        assert_eq!(totals.net, dec!(1000));
    }

    #[test]
    fn drawings_guard_skips_pnl_even_if_mistyped_expenses() {
        // Defense-in-depth: even if a drawings account is (wrongly) typed as an
        // Expenses account in the chart, the purpose stays PartnerDrawings and
        // removes it from the P&L (Sec 11 / Sec 31).
        let rev = account("4001", AccountType::Revenue);
        let drawings = Account::new(
            "4401".to_string(),
            "مسحوبات شركاء".to_string(),
            "Partner Drawings".to_string(),
            AccountType::Expenses,
            None,
            AccountCategory::Detail,
            1,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false),
            Decimal::ONE,
            None,
        )
        .unwrap()
        .with_purpose(domain::accounting::account::AccountPurpose::PartnerDrawings);
        let totals = compute_ledger_totals(&[rev.clone(), drawings.clone()], &[
            posted_entry(rev.id, 0, 1000),
            posted_entry(drawings.id, 250, 0),
        ]);
        assert_eq!(totals.net, dec!(1000));
    }

    #[test]
    fn explicit_period_wins_over_cutover() {
        let window = parse_period(
            Some("2026-01-01T00:00:00Z"),
            Some("2026-12-31T23:59:59Z"),
        );
        assert_eq!(window, Some((Some(expected_utc("2026-01-01T00:00:00Z")), Some(expected_utc("2026-12-31T23:59:59Z")))));
    }

    #[test]
    fn missing_period_falls_back_to_cutover() {
        assert_eq!(parse_period(None, None), None);
        assert_eq!(parse_period(Some("not-a-date"), Some("2026-12-31T23:59:59Z")), None);
        assert_eq!(parse_period(Some("2026-01-01T00:00:00Z"), None), None);
    }

    fn expected_utc(rfc3339: &str) -> chrono::DateTime<Utc> {
        chrono::DateTime::parse_from_rfc3339(rfc3339).unwrap().with_timezone(&Utc)
    }
}