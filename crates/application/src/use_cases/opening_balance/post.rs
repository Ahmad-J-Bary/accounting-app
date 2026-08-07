use std::sync::Arc;
use rust_decimal::Decimal;
use domain::accounting::account::AccountType;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, MonetaryAmount};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::OpeningMigrationDto;

/// Code of the opening-equity contra account used to balance the posting when
/// the user-supplied balances are not already in equilibrium (Debit = Credit).
const OPENING_EQUITY_ACCOUNT_CODE: &str = "53";

pub struct PostOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl PostOpeningBalanceUseCase {
    pub fn new(
        repo: Arc<dyn OpeningMigrationRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, id: String) -> Result<OpeningMigrationDto, AppError> {
        let mut migration = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        if migration.lines.is_empty() {
            return Err(AppError::Invalid("ترحيل الرصيد الافتتاحي بلا بنود".into()));
        }

        let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
        let mut debit_sum = Decimal::ZERO;
        let mut credit_sum = Decimal::ZERO;

        let mut lines: Vec<JournalLine> = Vec::with_capacity(migration.lines.len());
        for line in &migration.lines {
            let account = self.account_repo.find_by_id(&line.account_id).await?
                .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {}", line.account_id)))?;

            let amount = MonetaryAmount::from_base(line.amount, base_currency.clone());
            let debit_nature = matches!(account.account_type, AccountType::Assets | AccountType::Expenses);

            if debit_nature {
                debit_sum += line.amount;
            } else {
                credit_sum += line.amount;
            }

            let description = line.description.clone()
                .unwrap_or_else(|| format!("رصيد افتتاحي — {}", account.name_ar));

            lines.push(if debit_nature {
                JournalLine::new(line.account_id, amount.clone(), MonetaryAmount::zero(base_currency.clone()), description)
            } else {
                JournalLine::new(line.account_id, MonetaryAmount::zero(base_currency.clone()), amount.clone(), description)
            });
        }

        // Balance the posting against the opening-equity account so the migration
        // represents a true journal (Debit = Credit).
        if debit_sum != credit_sum {
            let equity = self.account_repo.find_by_code(OPENING_EQUITY_ACCOUNT_CODE).await?
                .ok_or_else(|| AppError::NotFound(
                    format!("حساب الرصيد الافتتاحي غير موجود: {OPENING_EQUITY_ACCOUNT_CODE}")
                ))?;
            let diff = (debit_sum - credit_sum).abs();
            let amount = MonetaryAmount::from_base(diff, base_currency.clone());
            let zero = MonetaryAmount::zero(base_currency.clone());
            let description = "تسوية رصيد افتتاحي".to_string();
            if debit_sum > credit_sum {
                lines.push(JournalLine::new(equity.id, zero, amount, description));
            } else {
                lines.push(JournalLine::new(equity.id, amount, zero, description));
            }
        }

        let mut entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::AccountOpeningBalance,
            lines,
            migration.cutover_date,
            "قيد ترحيل رصيد افتتاح الشركة".to_string(),
            Some(format!("opening_balance:{}", migration.id)),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        self.journal_repo.save(&entry).await?;

        migration.mark_posted().map_err(AppError::Domain)?;
        self.repo.update(&migration).await?;

        Ok(OpeningMigrationDto(migration))
    }
}