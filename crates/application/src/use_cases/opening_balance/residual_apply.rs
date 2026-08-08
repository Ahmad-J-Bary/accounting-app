use std::sync::Arc;
use rust_decimal::Decimal;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, MonetaryAmount};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::opening_posting_repository::OpeningPostingRepository;

const OPENING_EQUITY_ACCOUNT_CODE: &str = "53";

/// Moves the residual equity (the Opening Balance Control / OBE 53 balance) of
/// a posted opening-balance migration into the accountant-chosen classification
/// account through a real journal entry.
///
/// The system computes the residual but never decides its nature; this use case
/// executes the explicit accounting decision recorded by
/// `SetResidualClassificationUseCase` (Sec 6 / Sec 8).
///
///   Dr  Opening Balance Equity (53)
///       Cr  <classification account>           (for a credit residual)
///
/// or the reverse legs for a debit residual. The journal is a real, auditable
/// `GeneralJournal` entry and the reclassification timestamp is persisted
/// atomically with it, so the lock gate can prove 53 was re-classified.
pub struct ApplyResidualToLedgerUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    posting_repo: Arc<dyn OpeningPostingRepository>,
}

impl ApplyResidualToLedgerUseCase {
    pub fn new(
        repo: Arc<dyn OpeningMigrationRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        posting_repo: Arc<dyn OpeningPostingRepository>,
    ) -> Self {
        Self {
            repo,
            account_repo,
            journal_repo,
            posting_repo,
        }
    }

    pub async fn execute(&self, migration_id: String) -> Result<(), AppError> {
        let mut migration = self.repo.find_by_id(&migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        if migration.status != domain::accounting::MigrationStatus::Posted {
            return Err(AppError::Forbidden(
                "لا يمكن ترحيل التصنيف إلا لترحيل رصيد افتتاحي مرحَّل بالفعل".into(),
            ));
        }
        if migration.residual_applied_at.is_some() {
            return Err(AppError::Conflict(
                "تم ترحيل تصنيف الرصيد المتبقي بالفعل".into(),
            ));
        }

        let classification = migration.residual_classification
            .ok_or_else(|| AppError::Invalid("لم يتم تحديد تصنيف الرصيد المتبقي".into()))?;
        let residual_account_id = migration.residual_account_id
            .ok_or_else(|| AppError::Invalid("لم يتم تحديد حساب التصنيف للرصيد المتبقي".into()))?;

        let residual_amount = self.obe_balance(&migration_id).await?;
        if residual_amount == Decimal::ZERO {
            return Err(AppError::Invalid(
                "رصيد حساب الرصيد الافتتاحي (53) يساوي صفراً — لا يوجد رصيد متبقي لترحيله".into(),
            ));
        }

        let obe_account_id = self.account_repo.find_by_code(OPENING_EQUITY_ACCOUNT_CODE).await?
            .map(|a| a.id)
            .ok_or_else(|| AppError::NotFound("حساب الرصيد الافتتاحي (53) غير موجود".into()))?;

        let _ = self.account_repo.find_by_id(&residual_account_id).await?
            .ok_or_else(|| AppError::NotFound("حساب التصنيف غير موجود".into()))?;

        let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
        let amount = MonetaryAmount::from_base(residual_amount.abs(), base_currency.clone());
        let zero = MonetaryAmount::zero(base_currency);

        // OBE (53) is a credit-normal equity account. A credit residual sits on
        // the credit side of 53; to move it out we debit 53 and credit the
        // classification account. A debit residual mirrors: credit 53, debit
        // the classification account.
        let (debit_side, credit_side) = if residual_amount > Decimal::ZERO {
            (residual_account_id, obe_account_id)
        } else {
            (obe_account_id, residual_account_id)
        };

        let lines = vec![
            JournalLine::new(
                debit_side,
                amount.clone(),
                zero.clone(),
                "ترحيل الرصيد المتبقي من الرصيد الافتتاحي".to_string(),
            ),
            JournalLine::new(
                credit_side,
                zero,
                amount,
                format!("تصنيف الرصيد المتبقي: {}", classification.as_str()),
            ),
        ];

        let mut entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::GeneralJournal,
            lines,
            migration.cutover_date,
            "ترحيل تصنيف الرصيد المتبقي".to_string(),
            Some(format!("residual_classification:{migration_id}")),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        migration.mark_residual_applied().map_err(AppError::Domain)?;

        self.posting_repo.apply_residual(&migration, &entry).await?;

        Ok(())
    }

    /// The residual to reclassify is the current net of account 53 across all
    /// journal lines referencing this migration (posting journal + any earlier
    /// reclassifications). Because the posting journal is immutable, a residual
    /// journal's OBE leg cancels the posting OBE leg, netting toward zero after
    /// application.
    async fn obe_balance(&self, migration_id: &str) -> Result<Decimal, AppError> {
        let obe_account_id = self
            .account_repo.find_by_code(OPENING_EQUITY_ACCOUNT_CODE).await?
            .map(|a| a.id);

        let Some(obe_account_id) = obe_account_id else {
            return Ok(Decimal::ZERO);
        };

        let mut balance = Decimal::ZERO;
        for source_id in [
            format!("opening_balance:{migration_id}"),
            format!("residual_classification:{migration_id}"),
        ] {
            if let Some(entry) = self.journal_repo.find_by_source_id(&source_id).await? {
                for line in &entry.lines {
                    if line.account_id == obe_account_id {
                        balance += line.debit.base_amount - line.credit.base_amount;
                    }
                }
            }
        }
        Ok(balance)
    }
}