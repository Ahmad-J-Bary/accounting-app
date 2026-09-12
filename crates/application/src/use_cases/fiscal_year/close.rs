use std::collections::HashMap;
use std::sync::Arc;

use rust_decimal::Decimal;
use sqlx::SqlitePool;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::account::{Account, AccountPurpose};
use domain::accounting::fiscal_period::FiscalPeriodStatus;
use domain::accounting::fiscal_year::{FiscalYearCloseRun, FiscalYearCloseRunStatus, FiscalYearStatus};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::currency::Currency;
use domain::shared::ids::{AccountId, FiscalPeriodId, FiscalYearId, JournalEntryId};
use domain::shared::{MonetaryAmount, Money};

use super::create::to_dto;
use super::types::{CloseFiscalYearCommand, FiscalYearCloseRunDto, FiscalYearDto};

pub struct CloseFiscalYearUseCase {
    year_repo: Arc<dyn FiscalYearRepository>,
    period_repo: Arc<dyn FiscalPeriodRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_entry_repo: Arc<dyn JournalEntryRepository>,
    pool: Arc<SqlitePool>,
}

impl CloseFiscalYearUseCase {
    pub fn new(
        year_repo: Arc<dyn FiscalYearRepository>,
        period_repo: Arc<dyn FiscalPeriodRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_entry_repo: Arc<dyn JournalEntryRepository>,
        pool: Arc<SqlitePool>,
    ) -> Self {
        Self {
            year_repo,
            period_repo,
            account_repo,
            journal_entry_repo,
            pool,
        }
    }

    pub async fn execute(&self, cmd: CloseFiscalYearCommand) -> Result<FiscalYearDto, AppError> {
        require_permission(&cmd.context, "fiscal_year.close")?;

        let fiscal_year_id = cmd
            .fiscal_year_id
            .parse::<FiscalYearId>()
            .map_err(|_| AppError::Invalid("معرف السنة المالية غير صالح".into()))?;
        let closing_period_id = cmd
            .closing_period_id
            .parse::<FiscalPeriodId>()
            .map_err(|_| AppError::Invalid("معرف فترة الإقفال غير صالح".into()))?;

        let Some(mut fiscal_year) = self.year_repo.find_by_id(&fiscal_year_id).await? else {
            return Err(AppError::NotFound("السنة المالية غير موجودة".into()));
        };

        // Idempotency: if a completed close run exists for this operation_key, return early
        if let Some(existing_run) = self
            .year_repo
            .find_close_run(&fiscal_year_id, &cmd.operation_key)
            .await?
        {
            if existing_run.status == FiscalYearCloseRunStatus::Completed {
                return Ok(to_dto(&fiscal_year, Some(close_run_to_dto(&existing_run))));
            }
        }

        validate_year_close(&fiscal_year, &closing_period_id, self.period_repo.clone()).await?;

        let mut close_run = match self
            .year_repo
            .find_close_run(&fiscal_year_id, &cmd.operation_key)
            .await?
        {
            Some(run) => run,
            None => {
                let run = FiscalYearCloseRun::start(
                    fiscal_year_id,
                    cmd.operation_key.clone(),
                    actor_id(&cmd.context),
                )?;
                self.year_repo.create_close_run(&run).await?;
                run
            }
        };

        if fiscal_year.status == FiscalYearStatus::Closed
            && fiscal_year.last_close_operation_key.as_deref() == Some(cmd.operation_key.as_str())
        {
            return Ok(to_dto(&fiscal_year, Some(close_run_to_dto(&close_run))));
        }

        fiscal_year.start_closing(&actor_id(&cmd.context), &cmd.operation_key)?;

        if cmd.finalize {
            // --- Validate successor fiscal year exists (M1) ---
            let successor = self.find_successor_year(&fiscal_year).await?;

            // --- ATOMIC: Create closing + carry-forward + update fiscal year in one transaction ---
            let mut tx = self.pool.begin().await
                .map_err(|e| AppError::Infrastructure(format!("failed to begin close transaction: {e}")))?;

            // 1. Create closing journal entry (inside the transaction)
            let closing_entry_id = self
                .create_closing_entries_in_tx(&mut tx, &fiscal_year, &actor_id(&cmd.context))
                .await?;

            // 2. Create carry-forward journal entry in successor year (inside the transaction)
            let carry_forward_entry_id = self
                .create_carry_forward_entry_in_tx(&mut tx, &fiscal_year, &successor)
                .await?;

            // 3. Update fiscal year state (inside the transaction)
            fiscal_year.finalize_close(
                &actor_id(&cmd.context),
                &cmd.operation_key,
                closing_period_id,
                Some(closing_entry_id),
                carry_forward_entry_id,
            )?;
            self.year_repo.update_with_tx(&mut tx, &fiscal_year).await?;

            // 4. Update close run (inside the transaction)
            close_run.complete(
                closing_period_id,
                Some(closing_entry_id),
                carry_forward_entry_id,
            );
            self.year_repo.update_close_run_with_tx(&mut tx, &close_run).await?;

            // 5. Commit: all writes succeed or all roll back
            tx.commit().await
                .map_err(|e| AppError::Infrastructure(format!("failed to commit close transaction: {e}")))?;
        }

        Ok(to_dto(&fiscal_year, Some(close_run_to_dto(&close_run))))
    }

    /// Create the closing journal entry that transfers revenue and expense
    /// balances to Retained Earnings (account 52).
    ///
    /// Structure (M1 — Direct Close without Income Summary):
    ///   Dr Revenue accounts     Cr Retained Earnings  (for total revenue)
    ///   Dr Retained Earnings    Cr Expense accounts    (for total expenses)
    ///
    /// Combined into a single journal entry for atomicity.
    /// The entry is backdated to fiscal_year.end_date.
    ///
    /// For zero-profit years (Revenue == Expenses == 0), returns an error
    /// indicating no closing entry is needed.
    async fn create_closing_entries_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
        fiscal_year: &domain::accounting::fiscal_year::FiscalYear,
        _actor: &str,
    ) -> Result<JournalEntryId, AppError> {
        // 1. Aggregate posted balances for the fiscal year period
        let agg_rows = self
            .journal_entry_repo
            .aggregate_by_account_for_period(fiscal_year.start_date, fiscal_year.end_date)
            .await?;

        if agg_rows.is_empty() {
            return Err(AppError::Invalid(
                "لا توجد حسابات بقيود مرحلة في الفترة المالية المحددة".into(),
            ));
        }

        // 2. Load all referenced accounts
        let account_ids: Vec<_> = agg_rows.iter().map(|r| r.account_id).collect();
        let accounts = self.account_repo.find_by_ids(&account_ids).await?;
        let account_map: HashMap<AccountId, Account> =
            accounts.into_iter().map(|a| (a.id, a)).collect();

        // 3. Find Retained Earnings account (code "52", purpose RetainedEarnings)
        let retained_earnings_account = self
            .find_retained_earnings_account()
            .await?;

        // 4. Classify accounts into revenue vs expense, compute totals
        let mut revenue_total = Decimal::ZERO;
        let mut expense_total = Decimal::ZERO;
        let mut closing_lines: Vec<JournalLine> = Vec::new();

        let base_currency = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);

        for row in &agg_rows {
            let account = match account_map.get(&row.account_id) {
                Some(a) => a,
                None => continue,
            };

            let net = row.total_debit_base - row.total_credit_base;

            match account.account_type {
                domain::accounting::account::AccountType::Revenue => {
                    // Revenue is credit-normal: positive balance = credit > debit
                    // net = debit - credit, so for revenue: net is negative when there's income
                    // closing: Dr Revenue (to zero it), Cr Retained Earnings
                    let closing_debit = -net; // flip sign: credit-normal positive -> debit to close
                    if closing_debit <= Decimal::ZERO {
                        continue; // zero or already closed
                    }
                    revenue_total += closing_debit;
                    let debit = MonetaryAmount::new(
                        Money::new(closing_debit, base_currency.clone()),
                        Decimal::ONE,
                    );
                    let zero = MonetaryAmount::zero(base_currency.clone());
                    closing_lines.push(JournalLine::new(
                        row.account_id,
                        debit,
                        zero,
                        format!("إقفال حساب الإيرادات - {}", account.name_ar),
                    ));
                }
                domain::accounting::account::AccountType::Expenses => {
                    // Expenses are debit-normal: positive balance = debit > credit
                    // net = debit - credit, so for expenses: net is positive
                    // closing: Cr Expense (to zero it), Dr Retained Earnings
                    let closing_credit = net;
                    if closing_credit <= Decimal::ZERO {
                        continue;
                    }
                    expense_total += closing_credit;
                    let zero = MonetaryAmount::zero(base_currency.clone());
                    let credit = MonetaryAmount::new(
                        Money::new(closing_credit, base_currency.clone()),
                        Decimal::ONE,
                    );
                    closing_lines.push(JournalLine::new(
                        row.account_id,
                        zero,
                        credit,
                        format!("إقفال حساب المصاريف - {}", account.name_ar),
                    ));
                }
                _ => continue,
            }
        }

        // 5. Zero-profit year: no closing entry needed
        if revenue_total == Decimal::ZERO && expense_total == Decimal::ZERO {
            return Err(AppError::Invalid(
                "لا يوجد إيرادات أو مصاريف لإقفالها في هذه السنة المالية".into(),
            ));
        }

        // 6. Add Retained Earnings line (net profit = revenue - expenses)
        let net_profit = revenue_total - expense_total;
        if net_profit > Decimal::ZERO {
            // Profit: Cr Retained Earnings
            let zero = MonetaryAmount::zero(base_currency.clone());
            let credit = MonetaryAmount::new(
                Money::new(net_profit, base_currency.clone()),
                Decimal::ONE,
            );
            closing_lines.push(JournalLine::new(
                retained_earnings_account.id,
                zero,
                credit,
                "صافي الربح المحول إلى الأرباح المبقاة".into(),
            ));
        } else if net_profit < Decimal::ZERO {
            // Loss: Dr Retained Earnings
            let loss = -net_profit;
            let debit = MonetaryAmount::new(
                Money::new(loss, base_currency.clone()),
                Decimal::ONE,
            );
            let zero = MonetaryAmount::zero(base_currency.clone());
            closing_lines.push(JournalLine::new(
                retained_earnings_account.id,
                debit,
                zero,
                "الخالص المحول إلى الأرباح المبقاة (خسارة)".into(),
            ));
        }
        // If net_profit == 0, no RE line needed (revenue == expenses)

        // 7. Verify balanced entry
        let total_debit: Decimal = closing_lines.iter().map(|l| l.debit.base_amount).sum();
        let total_credit: Decimal = closing_lines.iter().map(|l| l.credit.base_amount).sum();
        if total_debit != total_credit {
            return Err(AppError::Invalid(format!(
                "قيود الإقفال غير متوازنة: إجمالي المدين {} ≠ إجمالي الدائن {}",
                total_debit, total_credit
            )));
        }

        // 8. Create and post the closing journal entry (backdated to year end)
        let entry_number = self.journal_entry_repo.get_next_entry_number_in_tx(tx).await?;
        let mut closing_entry = JournalEntry::new(
            entry_number,
            JournalType::FiscalClosing,
            closing_lines,
            fiscal_year.end_date,
            format!("إقفال السنة المالية {}", fiscal_year.label),
            Some(format!("fiscal_close:{}", fiscal_year.id)),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        closing_entry.post()
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_entry_repo.save_with_tx(tx, &closing_entry).await?;

        Ok(closing_entry.id)
    }

    /// Find the successor (next) fiscal year. The successor must exist before
    /// the current year can be closed — carry-forward requires a target year.
    async fn find_successor_year(
        &self,
        current: &domain::accounting::fiscal_year::FiscalYear,
    ) -> Result<domain::accounting::fiscal_year::FiscalYear, AppError> {
        // Look for a year whose previous_fiscal_year_id points to current year
        let all_years = self.year_repo.list().await?;
        if let Some(successor) = all_years.iter().find(|y| {
            y.previous_fiscal_year_id
                .as_ref()
                .map(|id| *id == current.id)
                .unwrap_or(false)
        }) {
            return Ok(successor.clone());
        }

        // Fallback: find a year whose start_date immediately follows current year's end_date
        if let Some(successor) = all_years.iter().find(|y| {
            y.start_date.date_naive() == current.end_date.date_naive()
                || y.start_date.date_naive() == current.end_date.date_naive() + chrono::Duration::days(1)
        }) {
            return Ok(successor.clone());
        }

        Err(AppError::Invalid(
            "لا يمكن إقفال السنة المالية بدون وجود سنة مالية تالية — أنشئ السنة المالية التالية أولاً".into(),
        ))
    }

    /// Create the carry-forward journal entry that establishes opening balances
    /// for balance-sheet accounts in the successor fiscal year.
    ///
    /// Uses `JournalType::AccountOpeningBalance` (existing type, period-exempt)
    /// dated at successor.start_date. One line per balance-sheet account with
    /// non-zero net balance. Debit-normal accounts land on debit side,
    /// credit-normal on credit side.
    ///
    /// Source metadata: source_id = "carry_forward:{fiscal_year_id}" for
    /// idempotency via UNIQUE(source_type, source_id).
    async fn create_carry_forward_entry_in_tx(
        &self,
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
        fiscal_year: &domain::accounting::fiscal_year::FiscalYear,
        successor: &domain::accounting::fiscal_year::FiscalYear,
    ) -> Result<Option<JournalEntryId>, AppError> {
        use domain::accounting::account::AccountType;

        // 1. Get cumulative GL balances for all accounts — read through the
        //    active transaction so the just-created FiscalClosing entry is
        //    visible to this aggregation (DEFECT-2 fix).
        let agg_rows = self
            .journal_entry_repo
            .aggregate_by_account_in_tx(tx)
            .await?;
        if agg_rows.is_empty() {
            return Ok(None);
        }

        // 2. Load account metadata
        let account_ids: Vec<_> = agg_rows.iter().map(|r| r.account_id).collect();
        let accounts = self.account_repo.find_by_ids(&account_ids).await?;
        let account_map: HashMap<AccountId, Account> =
            accounts.into_iter().map(|a| (a.id, a)).collect();

        // 3. Build carry-forward lines for balance-sheet accounts only
        let mut carry_lines: Vec<JournalLine> = Vec::new();
        let base_currency = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);

        for row in &agg_rows {
            let account = match account_map.get(&row.account_id) {
                Some(a) => a,
                None => continue,
            };

            // Only carry forward balance-sheet accounts
            match account.account_type {
                AccountType::Assets | AccountType::Liabilities | AccountType::Equity => {}
                _ => continue,
            }

            let net = row.total_debit_base - row.total_credit_base;
            if net == Decimal::ZERO {
                continue; // zero-balance accounts omitted
            }

            let amount = net.abs();
            let amount_ma = MonetaryAmount::new(
                Money::new(amount, base_currency.clone()),
                Decimal::ONE,
            );
            let zero = MonetaryAmount::zero(base_currency.clone());

            if net > Decimal::ZERO {
                // Debit-normal account (Assets): carry on debit side
                carry_lines.push(JournalLine::new(
                    row.account_id,
                    amount_ma,
                    zero,
                    format!("تحويل رصيد افتتاحي - {}", account.name_ar),
                ));
            } else {
                // Credit-normal account (Liabilities, Equity): carry on credit side
                carry_lines.push(JournalLine::new(
                    row.account_id,
                    zero,
                    amount_ma,
                    format!("تحويل رصيد افتتاحي - {}", account.name_ar),
                ));
            }
        }

        if carry_lines.is_empty() {
            return Ok(None);
        }

        // 4. Verify balanced entry
        let total_debit: Decimal = carry_lines.iter().map(|l| l.debit.base_amount).sum();
        let total_credit: Decimal = carry_lines.iter().map(|l| l.credit.base_amount).sum();
        if total_debit != total_credit {
            return Err(AppError::Invalid(format!(
                "قيود التحويل غير متوازنة: إجمالي المدين {} ≠ إجمالي الدائن {}",
                total_debit, total_credit
            )));
        }

        // 5. Create and post the carry-forward entry (dated at successor year start)
        let entry_number = self.journal_entry_repo.get_next_entry_number_in_tx(tx).await?;
        let mut cf_entry = JournalEntry::new(
            entry_number,
            JournalType::AccountOpeningBalance,
            carry_lines,
            successor.start_date,
            format!("تحويل رصيد افتتاحي من السنة المالية {}", fiscal_year.label),
            Some(format!("carry_forward:{}", fiscal_year.id)),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        cf_entry
            .post()
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_entry_repo.save_with_tx(tx, &cf_entry).await?;

        Ok(Some(cf_entry.id))
    }

    /// Find the Retained Earnings account by purpose.
    async fn find_retained_earnings_account(&self) -> Result<Account, AppError> {
        let all_accounts = self.account_repo.list_all().await?;
        all_accounts
            .into_iter()
            .find(|a| a.purpose == AccountPurpose::RetainedEarnings)
            .ok_or_else(|| {
                AppError::NotFound(
                    "حساب الأرباح المبقاة (52) غير موجود — يجب إنشاءه قبل إقفال السنة المالية".into(),
                )
            })
    }
}

fn actor_id(context: &domain::shared::ExecutionContext) -> String {
    context
        .actor_id
        .clone()
        .unwrap_or_else(|| "system".into())
}

pub(crate) fn require_permission(
    context: &domain::shared::ExecutionContext,
    permission_key: &str,
) -> Result<(), AppError> {
    if context.has_permission("Admin") || context.has_permission(permission_key) {
        return Ok(());
    }

    Err(AppError::Forbidden(format!(
        "لا تملك صلاحية تنفيذ العملية المطلوبة: {permission_key}"
    )))
}

async fn validate_year_close(
    fiscal_year: &domain::accounting::fiscal_year::FiscalYear,
    closing_period_id: &FiscalPeriodId,
    period_repo: Arc<dyn FiscalPeriodRepository>,
) -> Result<(), AppError> {
    let periods = period_repo.list().await?;
    let in_year: Vec<_> = periods
        .into_iter()
        .filter(|period| {
            period.company_id == fiscal_year.company_id
                && period.start_date >= fiscal_year.start_date
                && period.end_date <= fiscal_year.end_date
        })
        .collect();

    if in_year.is_empty() {
        return Err(AppError::LifecycleBlocked(
            "لا يمكن إقفال سنة مالية بلا فترات مالية مرتبطة ضمن نطاقها".into(),
        ));
    }

    if !in_year.iter().any(|period| period.id == *closing_period_id) {
        return Err(AppError::Invalid(
            "فترة الإقفال المحددة ليست ضمن السنة المالية".into(),
        ));
    }

    let invalid: Vec<String> = in_year
        .iter()
        .filter(|period| {
            !matches!(
                period.status,
                FiscalPeriodStatus::Closed | FiscalPeriodStatus::Locked
            )
        })
        .map(|period| format!("{}..{} ({})", period.start_date.date_naive(), period.end_date.date_naive(), period.status.as_str()))
        .collect();

    if !invalid.is_empty() {
        return Err(AppError::LifecycleBlocked(format!(
            "لا يمكن إقفال السنة المالية قبل إغلاق/قفل جميع الفترات: {}",
            invalid.join("، ")
        )));
    }

    Ok(())
}

pub(crate) fn close_run_to_dto(run: &FiscalYearCloseRun) -> FiscalYearCloseRunDto {
    FiscalYearCloseRunDto {
        operation_key: run.operation_key.clone(),
        actor_id: run.actor_id.clone(),
        status: run.status.as_str().into(),
        closing_period_id: run.closing_period_id.map(|value| value.to_string()),
        retained_earnings_entry_id: run
            .retained_earnings_entry_id
            .map(|value| value.to_string()),
        carry_forward_entry_id: run.carry_forward_entry_id.map(|value| value.to_string()),
        error_message: run.error_message.clone(),
        started_at: run.started_at.to_rfc3339(),
        completed_at: run.completed_at.map(|value| value.to_rfc3339()),
        updated_at: run.updated_at.to_rfc3339(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mocks::{MockAccountRepository, MockFiscalPeriodRepository, MockFiscalYearRepository, MockJournalRepository};
    use chrono::{Duration, Utc};
    use domain::accounting::account::{AccountCategory, AccountType};
    use domain::accounting::fiscal_period::FiscalPeriod;
    use domain::accounting::fiscal_year::FiscalYear;
    use domain::accounting::journal_entry::JournalEntryStatus;
    use domain::shared::ExecutionContext;
    use rust_decimal_macros::dec;

    fn make_account(id: AccountId, code: &str, name: &str, account_type: AccountType, purpose: AccountPurpose) -> Account {
        let currency = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        Account {
            id,
            code: code.to_string(),
            name_ar: name.to_string(),
            name_en: name.to_string(),
            account_type,
            parent_id: None,
            category: AccountCategory::Detail,
            level: 1,
            opening_balance: Decimal::ZERO,
            balance: Decimal::ZERO,
            notes: None,
            is_active: true,
            is_default: false,
            is_final: true,
            linked_customer_id: None,
            linked_supplier_id: None,
            debit: Decimal::ZERO,
            credit: Decimal::ZERO,
            currency,
            exchange_rate: Decimal::ONE,
            purpose,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn make_revenue_account(id: AccountId) -> Account {
        make_account(id, "4101", "إيرادات المبيعات", AccountType::Revenue, AccountPurpose::General)
    }

    fn make_expense_account(id: AccountId) -> Account {
        make_account(id, "5101", "مصاريف تشغيلية", AccountType::Expenses, AccountPurpose::General)
    }

    fn make_retained_earnings_account(id: AccountId) -> Account {
        make_account(id, "52", "أرباح مبقاة", AccountType::Equity, AccountPurpose::RetainedEarnings)
    }

    fn seeded_revenue_entry(revenue_id: AccountId, re_id: AccountId, amount: Decimal) -> JournalEntry {
        let base = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        let debit = MonetaryAmount::new(Money::new(amount, base.clone()), Decimal::ONE);
        let zero = MonetaryAmount::zero(base);
        let mut entry = JournalEntry::new(
            "100".into(),
            JournalType::GeneralJournal,
            vec![
                JournalLine::new(revenue_id, zero.clone(), debit.clone(), "revenue".into()),
                JournalLine::new(re_id, debit, zero, "revenue".into()),
            ],
            Utc::now(),
            "sale".into(),
            None,
        ).unwrap();
        entry.post().unwrap();
        entry
    }

    fn seeded_expense_entry(expense_id: AccountId, re_id: AccountId, amount: Decimal) -> JournalEntry {
        let base = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        let debit = MonetaryAmount::new(Money::new(amount, base.clone()), Decimal::ONE);
        let zero = MonetaryAmount::zero(base.clone());
        let credit = MonetaryAmount::new(Money::new(amount, base), Decimal::ONE);
        let mut entry = JournalEntry::new(
            "101".into(),
            JournalType::GeneralJournal,
            vec![
                JournalLine::new(expense_id, debit, zero, "expense".into()),
                JournalLine::new(re_id, MonetaryAmount::zero(Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false)), credit, "expense".into()),
            ],
            Utc::now(),
            "expense".into(),
            None,
        ).unwrap();
        entry.post().unwrap();
        entry
    }

    async fn setup_close_test(
        year_repo: &Arc<MockFiscalYearRepository>,
        period_repo: &Arc<MockFiscalPeriodRepository>,
        account_repo: &Arc<MockAccountRepository>,
        journal_repo: &Arc<MockJournalRepository>,
    ) -> (FiscalYearId, FiscalPeriodId, AccountId, AccountId, AccountId) {
        let start = Utc::now() - Duration::days(365);
        let end = Utc::now() - Duration::days(1);
        let year = FiscalYear::new(None, "FY2025".into(), start, end, None).unwrap();
        let year_id = year.id;
        year_repo.create(&year).await.unwrap();

        // Create successor fiscal year (required for carry-forward)
        let next_start = end + Duration::days(1);
        let next_end = end + Duration::days(366);
        let next_year = FiscalYear::new(None, "FY2026".into(), next_start, next_end, Some(year_id)).unwrap();
        year_repo.create(&next_year).await.unwrap();

        let mut period = FiscalPeriod::new(None, start, end).unwrap();
        period.close("admin", FiscalPeriodStatus::Closed).unwrap();
        let period_id = period.id;
        period_repo.create(&period).await.unwrap();

        let revenue_id = AccountId::new();
        let expense_id = AccountId::new();
        let re_id = AccountId::new();

        // Balance-sheet accounts for carry-forward testing
        let cash_id = AccountId::new();
        let ap_id = AccountId::new();
        let capital_id = AccountId::new();

        account_repo.accounts.lock().unwrap().extend([
            make_revenue_account(revenue_id),
            make_expense_account(expense_id),
            make_retained_earnings_account(re_id),
            make_account(cash_id, "1101", "البنك المركزي", AccountType::Assets, AccountPurpose::General),
            make_account(ap_id, "2101", "الموردون", AccountType::Liabilities, AccountPurpose::General),
            make_account(capital_id, "3101", "رأس المال", AccountType::Equity, AccountPurpose::General),
        ]);

        // Seed journal entries for the fiscal year
        let rev_entry = seeded_revenue_entry(revenue_id, re_id, dec!(5000));
        let exp_entry = seeded_expense_entry(expense_id, re_id, dec!(3000));

        // Balance-sheet entries: Cash Dr 10000, AP Cr 2000, Capital Cr 8000
        let base = Currency::new("IQD", "دينار عراقي", "IQD", "ع.د", 2, false);
        let cash_dr = MonetaryAmount::new(Money::new(dec!(10000), base.clone()), Decimal::ONE);
        let ap_cr = MonetaryAmount::new(Money::new(dec!(2000), base.clone()), Decimal::ONE);
        let capital_cr = MonetaryAmount::new(Money::new(dec!(8000), base.clone()), Decimal::ONE);
        let zero = MonetaryAmount::zero(base);

        let bs_entry = JournalEntry::new(
            "102".into(),
            JournalType::GeneralJournal,
            vec![
                JournalLine::new(cash_id, cash_dr, zero.clone(), "cash opening".into()),
                JournalLine::new(ap_id, zero.clone(), ap_cr.clone(), "ap opening".into()),
                JournalLine::new(capital_id, zero.clone(), capital_cr, "capital opening".into()),
            ],
            Utc::now(),
            "balance sheet setup".into(),
            None,
        ).unwrap();
        let mut bs_entry = bs_entry;
        bs_entry.post().unwrap();

        journal_repo.entries.lock().unwrap().extend([rev_entry, exp_entry, bs_entry]);

        (year_id, period_id, revenue_id, expense_id, re_id)
    }

    fn admin_context() -> ExecutionContext {
        ExecutionContext {
            actor_id: Some("admin".into()),
            permission_keys: vec!["fiscal_year.close".into()],
            ..ExecutionContext::default()
        }
    }

    #[tokio::test]
    async fn profit_year_closes_correctly() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _rev, _exp, _re) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-profit".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let result = use_case.execute(cmd).await.unwrap();
        assert_eq!(result.status, "Closed");
        assert!(result.retained_earnings_entry_id.is_some());

        // Verify closing entry was created
        let entries = journal_repo.entries.lock().unwrap();
        let closing = entries.iter().find(|e| e.journal_type == JournalType::FiscalClosing);
        assert!(closing.is_some(), "closing entry must exist");
        let closing = closing.unwrap();
        // Revenue (5000) + Expense (3000) + Retained Earnings (2000 profit) = 10000 total
        let total_debit: Decimal = closing.lines.iter().map(|l| l.debit.base_amount).sum();
        let total_credit: Decimal = closing.lines.iter().map(|l| l.credit.base_amount).sum();
        assert_eq!(total_debit, total_credit, "closing entry must be balanced");
    }

    #[tokio::test]
    async fn loss_year_closes_correctly() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _rev, _exp, _re) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        // Override: reduce revenue to create a loss
        {
            let mut entries = journal_repo.entries.lock().unwrap();
            entries.clear();
        }
        // Revenue = 2000, Expense = 3000 => Loss of 1000
        let revenue_id = AccountId::new();
        let expense_id = AccountId::new();
        let re_id = AccountId::new();
        {
            let mut accounts = account_repo.accounts.lock().unwrap();
            accounts.clear();
            accounts.extend([
                make_revenue_account(revenue_id),
                make_expense_account(expense_id),
                make_retained_earnings_account(re_id),
            ]);
        }
        let rev_entry = seeded_revenue_entry(revenue_id, re_id, dec!(2000));
        let exp_entry = seeded_expense_entry(expense_id, re_id, dec!(3000));
        journal_repo.entries.lock().unwrap().extend([rev_entry, exp_entry]);

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-loss".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let result = use_case.execute(cmd).await.unwrap();
        assert_eq!(result.status, "Closed");

        let entries = journal_repo.entries.lock().unwrap();
        let closing = entries.iter().find(|e| e.journal_type == JournalType::FiscalClosing).unwrap();
        let total_debit: Decimal = closing.lines.iter().map(|l| l.debit.base_amount).sum();
        let total_credit: Decimal = closing.lines.iter().map(|l| l.credit.base_amount).sum();
        assert_eq!(total_debit, total_credit);
    }

    #[tokio::test]
    async fn missing_retained_earnings_account_fails_safely() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        // Remove retained earnings account
        account_repo.accounts.lock().unwrap().retain(|a| a.purpose != AccountPurpose::RetainedEarnings);

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-no-re".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let err = use_case.execute(cmd).await.unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[tokio::test]
    async fn already_closed_year_is_idempotent() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-idempotent".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let first = use_case.execute(cmd.clone()).await.unwrap();
        assert_eq!(first.status, "Closed");

        let second = use_case.execute(cmd).await.unwrap();
        assert_eq!(second.status, "Closed");
    }

    #[tokio::test]
    async fn closing_entry_is_posted() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-posted".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        use_case.execute(cmd).await.unwrap();

        let entries = journal_repo.entries.lock().unwrap();
        let closing = entries.iter().find(|e| e.journal_type == JournalType::FiscalClosing).unwrap();
        assert_eq!(closing.status, JournalEntryStatus::Posted);
    }

    #[tokio::test]
    async fn atomic_close_updates_fiscal_year_and_creates_entry() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-atomic".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let result = use_case.execute(cmd).await.unwrap();
        assert_eq!(result.status, "Closed");

        // Both should be updated atomically: closing entry exists + FY is Closed
        let has_fiscal_closing = {
            let entries = journal_repo.entries.lock().unwrap();
            entries
                .iter()
                .any(|e| e.journal_type == JournalType::FiscalClosing)
        };
        assert!(
            has_fiscal_closing,
            "closing entry must be created atomically with fiscal year update"
        );

        let fy = year_repo.find_by_id(&year_id).await.unwrap().unwrap();
        assert_eq!(fy.status, FiscalYearStatus::Closed);
        assert!(fy.retained_earnings_entry_id.is_some());
    }

    // ==================== Carry-Forward Tests ====================

    #[tokio::test]
    async fn carry_forward_created_for_profit_year() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-cf".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let result = use_case.execute(cmd).await.unwrap();
        assert_eq!(result.status, "Closed");
        assert!(result.carry_forward_entry_id.is_some(), "carry-forward entry must be created");

        // Verify carry-forward entry exists and is posted
        let entries = journal_repo.entries.lock().unwrap();
        let cf_entry = entries.iter()
            .find(|e| e.source_id.as_deref() == Some(&format!("carry_forward:{}", year_id)));
        assert!(cf_entry.is_some(), "carry-forward journal entry must exist with correct source_id");
        let cf_entry = cf_entry.unwrap();
        assert_eq!(cf_entry.journal_type, JournalType::AccountOpeningBalance);
        assert_eq!(cf_entry.status, JournalEntryStatus::Posted);

        // Verify only balance-sheet accounts are included (no Revenue or Expense)
        let account_ids: Vec<_> = cf_entry.lines.iter().map(|l| l.account_id).collect();
        for aid in &account_ids {
            let acc = account_repo.accounts.lock().unwrap().iter().find(|a| &a.id == aid).cloned().unwrap();
            assert!(
                matches!(acc.account_type, AccountType::Assets | AccountType::Liabilities | AccountType::Equity),
                "carry-forward must only include balance-sheet accounts, got {:?} for {}",
                acc.account_type, acc.code
            );
        }

        // Verify entry is balanced
        let total_debit: Decimal = cf_entry.lines.iter().map(|l| l.debit.base_amount).sum();
        let total_credit: Decimal = cf_entry.lines.iter().map(|l| l.credit.base_amount).sum();
        assert_eq!(total_debit, total_credit, "carry-forward entry must be balanced");
    }

    #[tokio::test]
    async fn carry_forward_dates_at_successor_start() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let successor = year_repo.list().await.unwrap().into_iter()
            .find(|y| y.previous_fiscal_year_id.as_ref() == Some(&year_id))
            .unwrap();

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-cf-date".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        use_case.execute(cmd).await.unwrap();

        let entries = journal_repo.entries.lock().unwrap();
        let cf_entry = entries.iter()
            .find(|e| e.source_id.as_deref() == Some(&format!("carry_forward:{}", year_id)))
            .unwrap();

        // Carry-forward entry date must match successor year start date
        assert_eq!(
            cf_entry.entry_date.date_naive(),
            successor.start_date.date_naive(),
            "carry-forward entry must be dated at successor year start"
        );
    }

    #[tokio::test]
    async fn carry_forward_skips_revenue_and_expense() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, rev_id, exp_id, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-cf-skip".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        use_case.execute(cmd).await.unwrap();

        let entries = journal_repo.entries.lock().unwrap();
        let cf_entry = entries.iter()
            .find(|e| e.source_id.as_deref() == Some(&format!("carry_forward:{}", year_id)))
            .unwrap();

        // Revenue and Expense accounts must NOT appear in carry-forward
        assert!(!cf_entry.lines.iter().any(|l| l.account_id == rev_id),
            "revenue account must not appear in carry-forward");
        assert!(!cf_entry.lines.iter().any(|l| l.account_id == exp_id),
            "expense account must not appear in carry-forward");
    }

    #[tokio::test]
    async fn no_successor_year_fails() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        // Remove successor year (keep only the current year)
        {
            let mut years = year_repo.fiscal_years.lock().unwrap();
            years.retain(|y| y.previous_fiscal_year_id.is_none());
        }

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-no-successor".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let err = use_case.execute(cmd).await.unwrap_err();
        assert!(
            matches!(err, AppError::Invalid(_)),
            "closing without successor year must fail with Invalid error, got: {:?}",
            err
        );
    }

    #[tokio::test]
    async fn carry_forward_fiscal_year_recorded() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-cf-record".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        use_case.execute(cmd).await.unwrap();

        let fy = year_repo.find_by_id(&year_id).await.unwrap().unwrap();
        assert!(fy.carry_forward_entry_id.is_some(), "fiscal year must record carry_forward_entry_id");
    }

    // ==================== Carry-Forward Regression Tests ====================

    #[tokio::test]
    async fn carry_forward_concrete_case_cash_ap_capital() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, rev_id, exp_id, _re_id) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        // Find the balance-sheet account IDs
        let (cash_id, ap_id, capital_id) = {
            let accounts = account_repo.accounts.lock().unwrap();
            let cash_id = accounts.iter().find(|a| a.code == "1101").unwrap().id;
            let ap_id = accounts.iter().find(|a| a.code == "2101").unwrap().id;
            let capital_id = accounts.iter().find(|a| a.code == "3101").unwrap().id;
            (cash_id, ap_id, capital_id)
        };

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-cf-regression".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        use_case.execute(cmd).await.unwrap();

        let entries = journal_repo.entries.lock().unwrap();

        // 1. Verify closing entry zeros Revenue and Expense, transfers to RE
        let closing = entries.iter().find(|e| e.journal_type == JournalType::FiscalClosing).unwrap();
        let closing_lines: Vec<_> = closing.lines.iter().collect();

        // Revenue (5000): Dr Revenue 5000, Cr RE 5000
        let rev_line = closing_lines.iter().find(|l| l.account_id == rev_id).unwrap();
        assert_eq!(rev_line.debit.base_amount, dec!(5000), "closing must debit Revenue 5000");
        assert_eq!(rev_line.credit.base_amount, dec!(0), "closing Revenue credit must be 0");

        // Expense (3000): Dr RE 3000, Cr Expense 3000
        let exp_line = closing_lines.iter().find(|l| l.account_id == exp_id).unwrap();
        assert_eq!(exp_line.debit.base_amount, dec!(0), "closing Expense debit must be 0");
        assert_eq!(exp_line.credit.base_amount, dec!(3000), "closing must credit Expense 3000");

        // 2. Verify carry-forward entry includes balance-sheet accounts
        let cf = entries.iter().find(|e| e.source_id.as_deref() == Some(&format!("carry_forward:{}", year_id))).unwrap();
        assert_eq!(cf.journal_type, JournalType::AccountOpeningBalance);

        // Cash: Dr 10000
        let cf_cash = cf.lines.iter().find(|l| l.account_id == cash_id).unwrap();
        assert_eq!(cf_cash.debit.base_amount, dec!(10000), "carry-forward must debit Cash 10000");

        // AP: Cr 2000
        let cf_ap = cf.lines.iter().find(|l| l.account_id == ap_id).unwrap();
        assert_eq!(cf_ap.credit.base_amount, dec!(2000), "carry-forward must credit AP 2000");

        // Capital: Cr 8000
        let cf_capital = cf.lines.iter().find(|l| l.account_id == capital_id).unwrap();
        assert_eq!(cf_capital.credit.base_amount, dec!(8000), "carry-forward must credit Capital 8000");

        // 3. Verify carry-forward does NOT include Revenue or Expense
        assert!(!cf.lines.iter().any(|l| l.account_id == rev_id), "carry-forward must not include Revenue");
        assert!(!cf.lines.iter().any(|l| l.account_id == exp_id), "carry-forward must not include Expense");

        // 4. Verify carry-forward is balanced
        let cf_total_debit: Decimal = cf.lines.iter().map(|l| l.debit.base_amount).sum();
        let cf_total_credit: Decimal = cf.lines.iter().map(|l| l.credit.base_amount).sum();
        assert_eq!(cf_total_debit, cf_total_credit, "carry-forward must be balanced");
    }

    #[tokio::test]
    async fn aggregate_by_account_after_close_includes_fiscal_closing() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, rev_id, exp_id, re_id) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        use_case.execute(CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-agg-test".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        }).await.unwrap();

        // aggregate_by_account includes FiscalClosing
        let agg = journal_repo.aggregate_by_account().await.unwrap();
        let rev_row = agg.iter().find(|r| r.account_id == rev_id).unwrap();
        // Revenue: orig 5000 Cr, closing 5000 Dr => net 0
        assert_eq!(rev_row.total_debit_base - rev_row.total_credit_base, dec!(0),
            "Revenue net must be 0 after close (FiscalClosing included)");

        let exp_row = agg.iter().find(|r| r.account_id == exp_id).unwrap();
        // Expense: orig 3000 Dr, closing 3000 Cr => net 0
        assert_eq!(exp_row.total_debit_base - exp_row.total_credit_base, dec!(0),
            "Expense net must be 0 after close (FiscalClosing included)");

        // RE gets +2000 profit
        let re_row = agg.iter().find(|r| r.account_id == re_id).unwrap();
        // Seeded: Dr RE 5000 (revenue), Cr RE 3000 (expense) = net Dr 2000
        // Close: Cr RE 5000 (revenue close), Dr RE 3000 (expense close) = net Cr 2000
        // Net RE = 0 (closed to zero, operational activity absorbed by close entry)
        assert_eq!(re_row.total_credit_base - re_row.total_debit_base, dec!(0),
            "RE net must be 0 after close (seeded + close cancel out)");
    }

    #[tokio::test]
    async fn aggregate_by_account_report_after_close_excludes_fiscal_closing() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, rev_id, exp_id, _re_id) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        use_case.execute(CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-report-test".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        }).await.unwrap();

        // aggregate_by_account_report excludes FiscalClosing
        let report_agg = journal_repo.aggregate_by_account_report().await.unwrap();

        // Revenue still shows 5000 (operational activity only, closing excluded)
        let rev_row = report_agg.iter().find(|r| r.account_id == rev_id).unwrap();
        let rev_net = rev_row.total_credit_base - rev_row.total_debit_base;
        assert_eq!(rev_net, dec!(5000),
            "Income Statement Revenue must be 5000 (FiscalClosing excluded)");

        // Expense still shows 3000
        let exp_row = report_agg.iter().find(|r| r.account_id == exp_id).unwrap();
        let exp_net = exp_row.total_debit_base - exp_row.total_credit_base;
        assert_eq!(exp_net, dec!(3000),
            "Income Statement Expense must be 3000 (FiscalClosing excluded)");
    }

    // ==================== Zero-Profit Case ====================

    #[tokio::test]
    async fn zero_profit_year_closes_successfully() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        // Override: Revenue = Expense = 3000 (zero profit)
        {
            let mut entries = journal_repo.entries.lock().unwrap();
            entries.clear();
        }
        let revenue_id = AccountId::new();
        let expense_id = AccountId::new();
        let re_id = AccountId::new();
        {
            let mut accounts = account_repo.accounts.lock().unwrap();
            accounts.clear();
            accounts.extend([
                make_revenue_account(revenue_id),
                make_expense_account(expense_id),
                make_retained_earnings_account(re_id),
            ]);
        }
        let rev_entry = seeded_revenue_entry(revenue_id, re_id, dec!(3000));
        let exp_entry = seeded_expense_entry(expense_id, re_id, dec!(3000));
        journal_repo.entries.lock().unwrap().extend([rev_entry, exp_entry]);

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-zero-profit".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let result = use_case.execute(cmd).await.unwrap();
        assert_eq!(result.status, "Closed");

        let entries = journal_repo.entries.lock().unwrap();
        let closing = entries.iter().find(|e| e.journal_type == JournalType::FiscalClosing).unwrap();
        let total_debit: Decimal = closing.lines.iter().map(|l| l.debit.base_amount).sum();
        let total_credit: Decimal = closing.lines.iter().map(|l| l.credit.base_amount).sum();
        assert_eq!(total_debit, total_credit, "zero-profit closing must be balanced");

        // RE line should be zero (Revenue = Expense, no net transfer)
        let re_line = closing.lines.iter().find(|l| l.account_id == re_id);
        if let Some(re_line) = re_line {
            let re_net = re_line.credit.base_amount - re_line.debit.base_amount;
            assert_eq!(re_net, dec!(0), "zero-profit must not transfer to RE");
        }
    }

    // ==================== Idempotency Tests ====================

    #[tokio::test]
    async fn closing_twice_does_not_duplicate_entries() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-close-idempotent-v2".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let first = use_case.execute(cmd.clone()).await.unwrap();
        assert_eq!(first.status, "Closed");
        let first_close_count = journal_repo.entries.lock().unwrap()
            .iter()
            .filter(|e| e.journal_type == JournalType::FiscalClosing)
            .count();
        let first_cf_count = journal_repo.entries.lock().unwrap()
            .iter()
            .filter(|e| e.journal_type == JournalType::AccountOpeningBalance)
            .count();

        let second = use_case.execute(cmd).await.unwrap();
        assert_eq!(second.status, "Closed");
        let second_close_count = journal_repo.entries.lock().unwrap()
            .iter()
            .filter(|e| e.journal_type == JournalType::FiscalClosing)
            .count();
        let second_cf_count = journal_repo.entries.lock().unwrap()
            .iter()
            .filter(|e| e.journal_type == JournalType::AccountOpeningBalance)
            .count();

        assert_eq!(first_close_count, second_close_count,
            "closing twice must not duplicate closing entries");
        assert_eq!(first_cf_count, second_cf_count,
            "closing twice must not duplicate carry-forward entries");
    }

    // ==================== Atomicity / Rollback Test ====================

    #[tokio::test]
    async fn missing_re_account_prevents_any_journal_creation() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        // Remove retained earnings account — close must fail before any journal
        account_repo.accounts.lock().unwrap().retain(|a| a.purpose != AccountPurpose::RetainedEarnings);

        let entries_before = journal_repo.entries.lock().unwrap().len();

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        let cmd = CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-atomic-rollback".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        };

        let err = use_case.execute(cmd).await.unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));

        // Verify no new journal entries were created
        let entries_after = journal_repo.entries.lock().unwrap().len();
        assert_eq!(entries_before, entries_after,
            "failed close must not create any journal entries (atomic rollback)");

        // Verify fiscal year was NOT marked closed
        let fy = year_repo.find_by_id(&year_id).await.unwrap().unwrap();
        assert_ne!(fy.status, FiscalYearStatus::Closed,
            "fiscal year must not be closed when close fails");
    }

    // ==================== Report Regression Tests ====================

    #[tokio::test]
    async fn trial_balance_remains_balanced_after_close() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        use_case.execute(CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-tb-regression".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        }).await.unwrap();

        // Trial Balance: aggregate_by_account includes FiscalClosing
        let agg = journal_repo.aggregate_by_account().await.unwrap();
        let total_debit: Decimal = agg.iter().map(|r| r.total_debit_base).sum();
        let total_credit: Decimal = agg.iter().map(|r| r.total_credit_base).sum();
        assert_eq!(total_debit, total_credit,
            "Trial Balance must remain balanced after close (including FiscalClosing)");
    }

    #[tokio::test]
    async fn income_statement_shows_operational_activity_only() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, rev_id, exp_id, _) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        use_case.execute(CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-is-regression".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        }).await.unwrap();

        // Income Statement: aggregate_by_account_report excludes FiscalClosing
        let report_agg = journal_repo.aggregate_by_account_report().await.unwrap();

        // Revenue: original 5000 Cr (closing excluded)
        let rev_row = report_agg.iter().find(|r| r.account_id == rev_id).unwrap();
        let rev_amount = rev_row.total_credit_base - rev_row.total_debit_base;
        assert_eq!(rev_amount, dec!(5000),
            "Income Statement Revenue must be 5000 (operational only)");

        // Expense: original 3000 Dr (closing excluded)
        let exp_row = report_agg.iter().find(|r| r.account_id == exp_id).unwrap();
        let exp_amount = exp_row.total_debit_base - exp_row.total_credit_base;
        assert_eq!(exp_amount, dec!(3000),
            "Income Statement Expense must be 3000 (operational only)");

        // Net profit = 5000 - 3000 = 2000
        let net_profit = rev_amount - exp_amount;
        assert_eq!(net_profit, dec!(2000),
            "Income Statement Net Profit must be 2000");
    }

    #[tokio::test]
    async fn balance_sheet_includes_fiscal_closing_effect() {
        let year_repo = Arc::new(MockFiscalYearRepository::new());
        let period_repo = Arc::new(MockFiscalPeriodRepository::new());
        let account_repo = Arc::new(MockAccountRepository::new());
        let journal_repo = Arc::new(MockJournalRepository::default());

        let (year_id, period_id, _, _, re_id) =
            setup_close_test(&year_repo, &period_repo, &account_repo, &journal_repo).await;

        let use_case = CloseFiscalYearUseCase::new(
            year_repo.clone(), period_repo.clone(),
            account_repo.clone(), journal_repo.clone(),
            Arc::new(sqlx::SqlitePool::connect("sqlite::memory:").await.unwrap()),
        );

        use_case.execute(CloseFiscalYearCommand {
            fiscal_year_id: year_id.to_string(),
            closing_period_id: period_id.to_string(),
            operation_key: "fy-bs-regression".into(),
            finalize: true,
            retained_earnings_entry_id: None,
            carry_forward_entry_id: None,
            context: admin_context(),
        }).await.unwrap();

        // Balance Sheet: aggregate_by_account includes FiscalClosing
        let agg = journal_repo.aggregate_by_account().await.unwrap();

        // RE must reflect +2000 profit (5000 revenue - 3000 expense)
        // RE: seeded Dr 5000 - Cr 3000 = net Dr 2000, close reverses net Cr 2000 => RE = 0
        let re_row = agg.iter().find(|r| r.account_id == re_id).unwrap();
        let re_net = re_row.total_credit_base - re_row.total_debit_base;
        assert_eq!(re_net, dec!(0),
            "Balance Sheet RE must be 0 after close (operational activity closed to zero)");
    }
}
