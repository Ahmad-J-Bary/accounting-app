use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use rust_decimal::Decimal;

use domain::accounting::account::Account;
use domain::shared::ids::AccountId;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_item_repository::OpeningItemRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::obe::{
    obe_control_net, opening_source_id, OPENING_EQUITY_ACCOUNT_CODE,
};
use crate::use_cases::opening_balance::types::{
    OpeningItemInput, OpeningReconciliationDto, ReconciliationRow, KIND_AP, KIND_AR, KIND_BANK,
    KIND_FIXED_ASSET, KIND_INVENTORY, KIND_LOAN,
};

/// The six sub-ledgers supported by the opening-balance reconciliation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SubledgerKind {
    Ar,
    Ap,
    Inventory,
    FixedAssets,
    Bank,
    Loan,
}

impl SubledgerKind {
    pub fn key(self) -> &'static str {
        match self {
            Self::Ar => "AR",
            Self::Ap => "AP",
            Self::Inventory => "Inventory",
            Self::FixedAssets => "FixedAssets",
            Self::Bank => "Bank",
            Self::Loan => "Loan",
        }
    }

    pub fn all() -> [SubledgerKind; 6] {
        [
            Self::Ar,
            Self::Ap,
            Self::Inventory,
            Self::FixedAssets,
            Self::Bank,
            Self::Loan,
        ]
    }
}

/// Classifies an account into its opening sub-ledger category using the chart
/// account *purpose* semantics (Sec 46), not code-string matching.
pub fn account_subledger_kind(account: &Account) -> Option<SubledgerKind> {
    use domain::accounting::account::AccountPurpose;
    match account.purpose {
        AccountPurpose::Receivable => Some(SubledgerKind::Ar),
        AccountPurpose::Payable => Some(SubledgerKind::Ap),
        AccountPurpose::Inventory => Some(SubledgerKind::Inventory),
        AccountPurpose::FixedAsset => Some(SubledgerKind::FixedAssets),
        AccountPurpose::Bank => Some(SubledgerKind::Bank),
        AccountPurpose::Loan => Some(SubledgerKind::Loan),
        _ => None,
    }
}

/// General-ledger bucket totals derived from the migration's own opening lines.
/// This is the authoritative GL figure for reconciliation: the opening lines on
/// each sub-ledger's accounts must equal the entered sub-ledger detail totals.
pub fn gl_bucket_totals(
    migration: &domain::accounting::OpeningBalanceMigration,
    accounts: &HashMap<AccountId, Account>,
) -> HashMap<SubledgerKind, Decimal> {
    let mut buckets: HashMap<SubledgerKind, Decimal> = HashMap::new();
    for line in &migration.lines {
        let Some(account) = accounts.get(&line.account_id) else {
            continue;
        };
        let Some(kind) = account_subledger_kind(account) else {
            continue;
        };
        *buckets.entry(kind).or_default() += line.amount;
    }
    buckets
}

/// Sub-ledger item totals per category (AR / AP / Inventory / FA) from the
/// migration's real-entity link items.
pub fn detail_subledger_totals(items: &[OpeningItemInput]) -> HashMap<SubledgerKind, Decimal> {
    let mut totals: HashMap<SubledgerKind, Decimal> = HashMap::new();
    for it in items {
        let kind = match it.kind.as_str() {
            KIND_AR => SubledgerKind::Ar,
            KIND_AP => SubledgerKind::Ap,
            KIND_INVENTORY => SubledgerKind::Inventory,
            KIND_FIXED_ASSET => SubledgerKind::FixedAssets,
            KIND_BANK => SubledgerKind::Bank,
            KIND_LOAN => SubledgerKind::Loan,
            _ => continue,
        };
        if let Ok(value) = Decimal::from_str(&it.amount) {
            *totals.entry(kind).or_default() += value;
        }
    }
    totals
}

/// Human-readable blockers preventing a posting (or a lock) of a migration.
/// `require_control_zero` is only true for the lock gate: the Opening Balance
/// Control account (53) must be zero before locking, while a posting may still
/// carry an explicit classified residual that will be reclassified later.
pub fn readiness_blockers(
    recon: &OpeningReconciliationDto,
    require_control_zero: bool,
) -> Vec<String> {
    let mut blockers = Vec::new();
    if !recon.debit_equals_credit {
        blockers.push(
            "الترحيل غير متوازن: إجمالي المدين لا يساوي إجمالي الدائن (يجب تصنيف الرصيد المتبقي كبند صريح)".into(),
        );
    }
    if !recon.all_reconciled {
        blockers.push(
            "الواجهات الفرعية غير مطابقة: إجمالي بنود التفاصيل (العملاء/الموردون/المخزون/الأصول الثابتة/البنوك/القروض) لا يساوي دفتر الأستاذ".into(),
        );
    }
    if require_control_zero && recon.opening_control_balance != Decimal::ZERO {
        blockers.push(format!(
            "رصيد حساب الرصيد الافتتاحي (53) يجب أن يساوي صفراً قبل القفل (الحالي: {})",
            recon.opening_control_balance
        ));
    }
    blockers
}

/// Compares each opening sub-ledger (AR / AP / Inventory / Fixed Assets)
/// against the migration's own general-ledger opening lines and reports the
/// Opening Balance Control account balance — the input to the validation and
/// the enforcement gate for posting and locking.
pub struct GetOpeningReconciliationUseCase {
    migration_repo: Arc<dyn OpeningMigrationRepository>,
    detail_repo: Arc<dyn OpeningItemRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl GetOpeningReconciliationUseCase {
    pub fn new(
        migration_repo: Arc<dyn OpeningMigrationRepository>,
        detail_repo: Arc<dyn OpeningItemRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            migration_repo,
            detail_repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(
        &self,
        migration_id: String,
    ) -> Result<OpeningReconciliationDto, AppError> {
        let migration = self
            .migration_repo
            .find_by_id(&migration_id)
            .await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;
        let items = self.detail_repo.load_items(&migration_id).await?;

        // Resolve every account referenced by the migration lines once.
        let mut accounts: HashMap<AccountId, Account> = HashMap::new();
        for line in &migration.lines {
            if accounts.contains_key(&line.account_id) {
                continue;
            }
            if let Some(account) = self.account_repo.find_by_id(&line.account_id).await? {
                accounts.insert(line.account_id, account);
            }
        }

        let gl = gl_bucket_totals(&migration, &accounts);
        let sub = detail_subledger_totals(&items);

        let rows: Vec<ReconciliationRow> = SubledgerKind::all()
            .into_iter()
            .map(|kind| {
                let subledger = sub.get(&kind).copied().unwrap_or_default();
                let general_ledger = gl.get(&kind).copied().unwrap_or_default();
                ReconciliationRow {
                    key: kind.key().to_string(),
                    subledger,
                    general_ledger,
                    reconciled: subledger == general_ledger,
                }
            })
            .collect();

        let all_reconciled = rows.iter().all(|r| r.reconciled);

        // ---- Debit / Credit + Opening Control
        let obe_account_id = self
            .account_repo
            .find_by_code(OPENING_EQUITY_ACCOUNT_CODE)
            .await?
            .map(|a| a.id);

        // The Opening Balance Control is the net of account 53 across the
        // posting journal *and* any residual reclassification journal. The
        // residual journal's OBE leg cancels the posting OBE leg, so a
        // reclassified migration nets to zero here.
        let (debit_total, credit_total, opening_control_balance) = if let Some(entry) = self
            .journal_repo
            .find_by_source_id(&opening_source_id(&migration_id))
            .await?
        {
            (
                entry.lines.iter().map(|l| l.debit.base_amount).sum(),
                entry.lines.iter().map(|l| l.credit.base_amount).sum(),
                obe_control_net(&self.journal_repo, obe_account_id, &migration_id).await?,
            )
        } else {
            let (d, c) = drift_totals(&migration, &self.account_repo).await?;
            (d, c, d - c)
        };

        Ok(OpeningReconciliationDto {
            rows,
            all_reconciled,
            opening_control_balance,
            debit_total,
            credit_total,
            debit_equals_credit: debit_total == credit_total,
        })
    }
}

/// Classifies migration lines into a debit and a credit total using each
/// account's nature (the pre-posting fallback of the reconciliation DTO).
async fn drift_totals(
    migration: &domain::accounting::OpeningBalanceMigration,
    account_repo: &Arc<dyn AccountRepository>,
) -> Result<(Decimal, Decimal), AppError> {
    let mut d = Decimal::ZERO;
    let mut c_ = Decimal::ZERO;
    for line in &migration.lines {
        let account = account_repo
            .find_by_id(&line.account_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {}", line.account_id)))?;
        if matches!(
            account.normal_balance(),
            domain::accounting::account::NormalBalance::Debit
        ) {
            d += line.amount;
        } else {
            c_ += line.amount;
        }
    }
    Ok((d, c_))
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::account::{Account, AccountCategory, AccountType};
    use domain::shared::currency::Currency;
    use rust_decimal_macros::dec;

    fn account(code: &str, account_type: AccountType) -> Account {
        use domain::accounting::account::AccountPurpose;
        let purpose = if code.starts_with("1203") && account_type == AccountType::Assets {
            AccountPurpose::Receivable
        } else if code.starts_with("2203") && account_type == AccountType::Liabilities {
            AccountPurpose::Payable
        } else if code.starts_with("1204") && account_type == AccountType::Assets {
            AccountPurpose::Inventory
        } else if code == "125" && account_type == AccountType::Assets {
            AccountPurpose::Bank
        } else if code == "224" && account_type == AccountType::Liabilities {
            AccountPurpose::Loan
        } else if code.starts_with("11") && account_type == AccountType::Assets {
            AccountPurpose::FixedAsset
        } else {
            AccountPurpose::General
        };
        Account::new(
            code.to_string(),
            format!("حساب {}", code),
            format!("Account {}", code),
            account_type,
            None,
            AccountCategory::Detail,
            3,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false),
            Decimal::ONE,
            None,
        )
        .unwrap()
        .with_purpose(purpose)
    }

    #[test]
    fn account_subledger_kind_maps_codes() {
        assert_eq!(
            account_subledger_kind(&account("1203", AccountType::Assets)),
            Some(SubledgerKind::Ar)
        );
        assert_eq!(
            account_subledger_kind(&account("120301", AccountType::Assets)),
            Some(SubledgerKind::Ar)
        );
        assert_eq!(
            account_subledger_kind(&account("2203", AccountType::Liabilities)),
            Some(SubledgerKind::Ap)
        );
        assert_eq!(
            account_subledger_kind(&account("220301", AccountType::Liabilities)),
            Some(SubledgerKind::Ap)
        );
        assert_eq!(
            account_subledger_kind(&account("1204", AccountType::Assets)),
            Some(SubledgerKind::Inventory)
        );
        assert_eq!(
            account_subledger_kind(&account("120401", AccountType::Assets)),
            Some(SubledgerKind::Inventory)
        );
        assert_eq!(
            account_subledger_kind(&account("1101", AccountType::Assets)),
            Some(SubledgerKind::FixedAssets)
        );
        assert_eq!(
            account_subledger_kind(&account("1102", AccountType::Assets)),
            Some(SubledgerKind::FixedAssets)
        );
        assert_eq!(
            account_subledger_kind(&account("125", AccountType::Assets)),
            Some(SubledgerKind::Bank)
        );
        assert_eq!(
            account_subledger_kind(&account("224", AccountType::Liabilities)),
            Some(SubledgerKind::Loan)
        );
        assert_eq!(
            account_subledger_kind(&account("1001", AccountType::Assets)),
            None,
            "cash is not a sub-ledger"
        );
        assert_eq!(
            account_subledger_kind(&account("51", AccountType::Equity)),
            None
        );
    }

    #[test]
    fn readiness_blockers_combines_post_and_lock_gates() {
        let ok = OpeningReconciliationDto {
            rows: vec![],
            all_reconciled: true,
            opening_control_balance: Decimal::ZERO,
            debit_total: dec!(100),
            credit_total: dec!(100),
            debit_equals_credit: true,
        };
        assert!(readiness_blockers(&ok, false).is_empty());
        assert!(readiness_blockers(&ok, true).is_empty());

        let unbalanced = OpeningReconciliationDto {
            debit_total: dec!(100),
            credit_total: dec!(90),
            debit_equals_credit: false,
            ..ok.clone()
        };
        assert_eq!(readiness_blockers(&unbalanced, false).len(), 1);

        let not_reconciled = OpeningReconciliationDto {
            all_reconciled: false,
            ..ok.clone()
        };
        assert_eq!(readiness_blockers(&not_reconciled, false).len(), 1);

        let control_nonzero = OpeningReconciliationDto {
            opening_control_balance: dec!(40),
            ..ok.clone()
        };
        assert!(
            readiness_blockers(&control_nonzero, false).is_empty(),
            "posting may carry classified residual"
        );
        assert_eq!(
            readiness_blockers(&control_nonzero, true).len(),
            1,
            "locking requires control == 0"
        );
    }

    #[test]
    fn detail_totals_from_real_entity_links() {
        let items = vec![
            OpeningItemInput {
                kind: KIND_AR.into(),
                entity_id: "a".into(),
                reference: None,
                amount: "100.00".into(),
                qty: "1".into(),
            },
            OpeningItemInput {
                kind: KIND_AR.into(),
                entity_id: "b".into(),
                reference: None,
                amount: "50.00".into(),
                qty: "1".into(),
            },
            OpeningItemInput {
                kind: KIND_AP.into(),
                entity_id: "c".into(),
                reference: None,
                amount: "30.00".into(),
                qty: "1".into(),
            },
            OpeningItemInput {
                kind: KIND_INVENTORY.into(),
                entity_id: "m1".into(),
                reference: None,
                amount: "200.00".into(),
                qty: "10".into(),
            },
            OpeningItemInput {
                kind: KIND_FIXED_ASSET.into(),
                entity_id: "f1".into(),
                reference: None,
                amount: "900.00".into(),
                qty: "1".into(),
            },
            OpeningItemInput {
                kind: KIND_BANK.into(),
                entity_id: "b1".into(),
                reference: None,
                amount: "40.00".into(),
                qty: "1".into(),
            },
            OpeningItemInput {
                kind: KIND_LOAN.into(),
                entity_id: "l1".into(),
                reference: None,
                amount: "50.00".into(),
                qty: "1".into(),
            },
            OpeningItemInput {
                kind: "Unknown".into(),
                entity_id: "x".into(),
                reference: None,
                amount: "999.00".into(),
                qty: "1".into(),
            },
        ];
        let totals = detail_subledger_totals(&items);
        assert_eq!(
            totals.get(&SubledgerKind::Ar).copied().unwrap_or_default(),
            Decimal::new(15000, 2)
        );
        assert_eq!(
            totals.get(&SubledgerKind::Ap).copied().unwrap_or_default(),
            Decimal::new(3000, 2)
        );
        assert_eq!(
            totals
                .get(&SubledgerKind::Inventory)
                .copied()
                .unwrap_or_default(),
            Decimal::new(20000, 2)
        );
        assert_eq!(
            totals
                .get(&SubledgerKind::FixedAssets)
                .copied()
                .unwrap_or_default(),
            Decimal::new(90000, 2)
        );
        assert_eq!(
            totals
                .get(&SubledgerKind::Bank)
                .copied()
                .unwrap_or_default(),
            Decimal::new(4000, 2)
        );
        assert_eq!(
            totals
                .get(&SubledgerKind::Loan)
                .copied()
                .unwrap_or_default(),
            Decimal::new(5000, 2)
        );
    }
}
