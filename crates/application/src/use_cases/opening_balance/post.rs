use std::sync::Arc;
use domain::accounting::account::AccountType;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Currency, MonetaryAmount};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_detail_repository::OpeningDetailRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::opening_posting_repository::OpeningPostingRepository;
use crate::use_cases::opening_balance::reconcile::{readiness_blockers, GetOpeningReconciliationUseCase};
use crate::use_cases::opening_balance::types::{OpeningMigrationDto, PostOpeningBalanceResult};

pub struct PostOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    detail_repo: Arc<dyn OpeningDetailRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    posting_repo: Arc<dyn OpeningPostingRepository>,
}

impl PostOpeningBalanceUseCase {
    pub fn new(
        repo: Arc<dyn OpeningMigrationRepository>,
        detail_repo: Arc<dyn OpeningDetailRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        posting_repo: Arc<dyn OpeningPostingRepository>,
    ) -> Self {
        Self {
            repo,
            detail_repo,
            account_repo,
            journal_repo,
            posting_repo,
        }
    }

    pub async fn execute(&self, id: String) -> Result<PostOpeningBalanceResult, AppError> {
        let mut migration = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        if migration.lines.is_empty() {
            return Err(AppError::Invalid("ترحيل الرصيد الافتتاحي بلا بنود".into()));
        }

        // Enforcement gate: a migration may only be posted when its opening lines
        // are in equilibrium (Debit = Credit) AND the entered sub-ledger details
        // reconcile to the general-ledger opening lines. No silent plug account.
        let recon = GetOpeningReconciliationUseCase::new(
            self.repo.clone(),
            self.detail_repo.clone(),
            self.account_repo.clone(),
            self.journal_repo.clone(),
        )
        .execute(id.clone())
        .await?;

        let blockers = readiness_blockers(&recon, false);
        if !blockers.is_empty() {
            return Err(AppError::Invalid(blockers.join("؛ ")));
        }

        let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);

        let mut lines: Vec<JournalLine> = Vec::with_capacity(migration.lines.len());
        for line in &migration.lines {
            let account = self.account_repo.find_by_id(&line.account_id).await?
                .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {}", line.account_id)))?;

            let amount = MonetaryAmount::from_base(line.amount, base_currency.clone());
            let debit_nature = matches!(account.account_type, AccountType::Assets | AccountType::Expenses);

            let description = line.description.clone()
                .unwrap_or_else(|| format!("رصيد افتتاحي — {}", account.name_ar));

            lines.push(if debit_nature {
                JournalLine::new(line.account_id, amount.clone(), MonetaryAmount::zero(base_currency.clone()), description)
            } else {
                JournalLine::new(line.account_id, MonetaryAmount::zero(base_currency.clone()), amount.clone(), description)
            });
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

        // Mark the domain aggregate as posted (state guard) then persist the
        // journal + status change in a single transaction (atomicity).
        migration.mark_posted().map_err(AppError::Domain)?;
        self.posting_repo.post(&migration, &entry).await?;

        Ok(PostOpeningBalanceResult {
            migration: OpeningMigrationDto(migration),
            debit_total: recon.debit_total,
            credit_total: recon.credit_total,
            equity_balanced: recon.debit_equals_credit,
        })
    }
}
