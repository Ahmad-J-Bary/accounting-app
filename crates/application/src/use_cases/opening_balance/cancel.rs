use std::sync::Arc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::MigrationStatus;

use crate::errors::AppError;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::opening_posting_repository::OpeningPostingRepository;
use crate::use_cases::opening_balance::guard::opening_lifecycle_closed;
use crate::use_cases::opening_balance::types::OpeningMigrationDto;

/// Executes a cancellation of a previously-posted opening-balance migration by
/// posting a true reversing journal entry (debit/credit swapped) and marking the
/// migration `Cancelled` — both committed in a single transaction.
pub struct CancelOpeningBalanceUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    posting_repo: Arc<dyn OpeningPostingRepository>,
}

impl CancelOpeningBalanceUseCase {
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        posting_repo: Arc<dyn OpeningPostingRepository>,
    ) -> Self {
        Self { migration_repo, journal_repo, posting_repo }
    }

    pub async fn execute(&self, id: String) -> Result<OpeningMigrationDto, AppError> {
        // Phase 5: once any migration is Locked the lifecycle is sealed; the
        // only mutation from then on is read-only history.
        if opening_lifecycle_closed(&self.migration_repo).await? {
            return Err(AppError::Forbidden(
                "الرصيد الافتتاحي للشركة أُقفل نهائياً — لا يمكن إلغاء ترحيلات الرصيد الافتتاحي بعد الإقفال".into(),
            ));
        }

        let mut migration = self.migration_repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        match migration.status {
            MigrationStatus::Draft | MigrationStatus::Validated | MigrationStatus::Approved => {
                migration.cancel().map_err(AppError::Domain)?;
                self.migration_repo.update(&migration).await?;
                return Ok(OpeningMigrationDto(migration));
            }
            MigrationStatus::Cancelled => {
                // Idempotent: already cancelled, nothing to do.
                return Ok(OpeningMigrationDto(migration));
            }
            MigrationStatus::Locked => {
                return Err(AppError::Forbidden(
                    "الترحيل مقفول؛ يجب إلغاء القفل أولاً قبل الإلغاء".into(),
                ));
            }
            MigrationStatus::Posted => {}
        }

        // Locate the originally-posted opening journal used to derive the contra entry.
        let source_id = format!("opening_balance:{}", migration.id);
        let posted = self.journal_repo.find_by_source_id(&source_id).await?
            .ok_or_else(|| AppError::NotFound("قيد ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        if posted.status != domain::accounting::JournalEntryStatus::Posted {
            return Err(AppError::Forbidden(
                "قيد الترحيل تمت معالجته مسبقاً (مُرحل/معكوس)".into(),
            ));
        }

        // Reverse each line by swapping debit and credit.
        let reversed_lines: Vec<JournalLine> = posted
            .lines
            .iter()
            .map(|l| JournalLine {
                account_id: l.account_id,
                partner_id: l.partner_id,
                debit: l.credit.clone(),
                credit: l.debit.clone(),
                description: format!("عكس قيد رصيد الافتتاح — {}", l.description),
            })
            .collect();

        let mut reversal = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::OpeningBalanceReversal,
            reversed_lines,
            migration.cutover_date,
            "عكس ترحيل رصيد الافتتاح (إلغاء)".to_string(),
            Some(format!("ob_reversal:{}", migration.id)),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        reversal.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        migration.un_post().map_err(AppError::Domain)?;
        self.posting_repo.cancel(&migration, &reversal).await?;

        Ok(OpeningMigrationDto(migration))
    }
}

#[cfg(test)]
mod tests {
    use domain::accounting::journal_entry::JournalLine;
    use domain::shared::{AccountId, Currency, MonetaryAmount};
    use rust_decimal::Decimal;

    #[test]
    fn reversing_lines_stay_balanced() {
        let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);
        let a = MonetaryAmount::from_base(Decimal::new(1000, 2), base_currency.clone());
        let z = MonetaryAmount::zero(base_currency.clone());

        let line = JournalLine::new(
            AccountId(uuid::Uuid::new_v4()),
            a.clone(),
            z.clone(),
            "test".to_string(),
        );
        let reversed = JournalLine {
            account_id: line.account_id,
            partner_id: line.partner_id,
            debit: line.credit.clone(),
            credit: line.debit.clone(),
            description: line.description.clone(),
        };

        // Debit and credit totals of the reversed line mirror the original.
        assert_eq!(reversed.debit.amount(), line.credit.amount());
        assert_eq!(reversed.credit.amount(), line.debit.amount());
        assert_eq!(
            reversed.debit.amount() + reversed.credit.amount(),
            line.debit.amount() + line.credit.amount()
        );
    }
}