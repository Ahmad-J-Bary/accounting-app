use std::sync::Arc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::accounting::JournalEntryStatus;
use domain::shared::{Currency, MonetaryAmount};

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_item_repository::OpeningItemRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::opening_posting_repository::OpeningPostingRepository;
use crate::use_cases::opening_balance::reconcile::{readiness_blockers, GetOpeningReconciliationUseCase};
use crate::use_cases::opening_balance::types::{OpeningMigrationDto, PostOpeningBalanceResult};

/// Migration aggregate journals (and their artifacts) carry these source_id
/// prefixes; anything else on an opening journal is a standalone per-entity
/// journal that was posted directly (customer/supplier `save_with_accounting`,
/// material-opening invoice) — the R1 duplication source.
const OPEN_PIVOT_PREFIXES: [&str; 3] = [
    "opening_balance:",
    "residual_classification:",
    "ob_reversal:",
];

pub struct PostOpeningBalanceUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    detail_repo: Arc<dyn OpeningItemRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    posting_repo: Arc<dyn OpeningPostingRepository>,
}

impl PostOpeningBalanceUseCase {
    pub fn new(
        repo: Arc<dyn OpeningMigrationRepository>,
        detail_repo: Arc<dyn OpeningItemRepository>,
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

        // R1 prevention (Phase 3): the migration aggregate owns the GL position
        // of every opening sub-ledger. If an account included in this migration
        // was ALREADY booked by a standalone per-entity opening journal (posted
        // while the opening window was closed), posting the migration again
        // would double-book the same balance. Fail loudly instead of silently
        // netting the GL.
        let dupes = self.already_booked_opening_accounts(&id).await?;
        if !dupes.is_empty() {
            let msg = dupes
                .iter()
                .map(|(name, amount)| {
                    format!("الحساب {name} مسجل رصيده الافتتاحي ({amount}) كقيد مستقل سابقاً — لا يمكن ترحيله ضمن الرصيد الافتتاحي مرة أخرى؛ ألغِ القيد المستقل (Reversal) أولاً")
                })
                .collect::<Vec<_>>()
                .join("؛ ");
            return Err(AppError::Forbidden(msg));
        }

        let base_currency = Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false);

        let mut lines: Vec<JournalLine> = Vec::with_capacity(migration.lines.len());
        for line in &migration.lines {
            let account = self.account_repo.find_by_id(&line.account_id).await?
                .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {}", line.account_id)))?;

            // Opening balances carry balance-sheet items only. P&L accounts
            // (Revenue/Expenses) are never posted to the Opening Balance; the
            // historical result flows through Retained Earnings / the residual.
            super::guard::reject_pl_account(&account)?;

            let amount = MonetaryAmount::from_base(line.amount, base_currency.clone());
            // Debit-normal accounts (assets, expenses, *drawings*) carry the
            // opening amount on the debit side; credit-normal accounts land on
            // credit (Sec 12 normal-balance convention).
            let debit_nature = matches!(
                account.normal_balance(),
                domain::accounting::account::NormalBalance::Debit
            );

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

    /// Returns the accounts (with booked amounts) that already have a POSTED
    /// standalone opening journal on the migration's line amount, i.e. whose
    /// opening balance was booked directly by a per-entity journal while the
    /// opening window was closed. Posting the migration would duplicate them.
    async fn already_booked_opening_accounts(
        &self,
        id: &str,
    ) -> Result<Vec<(String, String)>, AppError> {
        use std::collections::{HashMap, HashSet};

        let migration = self.repo.find_by_id(id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        // Group migration line amounts by account: an opening journal may only
        // be a duplicate when its line matches one of these amounts exactly.
        let mut expected: HashMap<String, Vec<rust_decimal::Decimal>> = HashMap::new();
        for line in &migration.lines {
            let account = self.account_repo.find_by_id(&line.account_id).await?
                .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {}", line.account_id)))?;
            expected
                .entry(account.id.0.to_string())
                .or_default()
                .push(line.amount);
        }

        let mut flagged: Vec<(String, String)> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();

        for journal in self.journal_repo.list_all().await? {
            // Only posted standalone Account/MaterialOpeningBalance journals can
            // pre-book an opening position that the migration would duplicate.
            if journal.status != JournalEntryStatus::Posted {
                continue;
            }
            let is_opening = matches!(
                journal.journal_type,
                JournalType::AccountOpeningBalance | JournalType::MaterialOpeningBalance
            );
            if !is_opening {
                continue;
            }
            if let Some(source) = journal.source_id.as_deref() {
                if OPEN_PIVOT_PREFIXES.iter().any(|p| source.starts_with(p)) {
                    continue; // the migration's own aggregate / artifacts
                }
            }

            for line in &journal.lines {
                let Some(amounts) = expected.get(&line.account_id.0.to_string()) else { continue };
                let booked = if !line.debit.amount().is_zero() {
                    line.debit.amount()
                } else {
                    line.credit.amount()
                };
                if amounts.contains(&booked) && seen.insert(line.account_id.0.to_string()) {
                    let name = self
                        .account_repo
                        .find_by_id(&line.account_id)
                        .await?
                        .map(|a| a.name_ar)
                        .unwrap_or_else(|| line.account_id.0.to_string());
                    flagged.push((name.clone(), format!("{booked}")));
                }
            }
        }
        Ok(flagged)
    }
}
