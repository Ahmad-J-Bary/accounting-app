use std::sync::Arc;

use domain::accounting::account::{Account, AccountCategory};
use domain::accounting::ResidualClassification;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::use_cases::opening_balance::types::{
    ResidualClassificationSpec, ResidualDesignatedAccountDto,
};

/// Every residual classification maps to ONE controlled account purpose — the
/// user chooses the ACCOUNTING MEANING, the system chooses the appropriate
/// account (Phase 4). Only `UnresolvedDifference` has no purpose/account and
/// blocks posting & locking.
pub const CLASSIFICATIONS: [ResidualClassification; 5] = [
    ResidualClassification::RetainedEarnings,
    ResidualClassification::OpeningEquityAdjustment,
    ResidualClassification::PriorPeriodAdjustment,
    ResidualClassification::OtherEquity,
    ResidualClassification::UnresolvedDifference,
];

/// Designated chart code of a classification's default account (the seeded
/// system accounts 52 / 521 / 525 / 526). Used only as a fallback when
/// purpose-based resolution finds no active designated account.
fn designated_code(classification: ResidualClassification) -> Option<&'static str> {
    match classification {
        ResidualClassification::RetainedEarnings => Some("52"),
        ResidualClassification::OpeningEquityAdjustment => Some("521"),
        ResidualClassification::PriorPeriodAdjustment => Some("525"),
        ResidualClassification::OtherEquity => Some("526"),
        ResidualClassification::UnresolvedDifference => None,
    }
}

/// Plain-Arabic copy shown in the journal preview before posting.
fn treatment_ar(classification: ResidualClassification) -> &'static str {
    match classification {
        ResidualClassification::RetainedEarnings => {
            "سيتم نقل الرصيد من حساب التسوية الافتتاحية (53) إلى الأرباح المبقاة."
        }
        ResidualClassification::OpeningEquityAdjustment => {
            "سيتم نقل الرصيد من حساب التسوية الافتتاحية (53) إلى حساب تعديل حقوق الملكية الافتتاحي."
        }
        ResidualClassification::PriorPeriodAdjustment => {
            "سيتم نقل الرصيد إلى حساب تعديل فترة سابقة — تصحيح محاسبي لفترة سابقة ويتطلب تأكيداً صريحاً."
        }
        ResidualClassification::OtherEquity => {
            "سيتم نقل الرصيد من حساب التسوية الافتتاحية (53) إلى حساب حقوق ملكية أخرى."
        }
        ResidualClassification::UnresolvedDifference => {
            "الفرق غير محلول: لن يُرحَّل ولن يُقفَل حتى يُحل الفرق أو يُغيّر التصنيف."
        }
    }
}

/// Resolves the designated account that carries a classification, preferring
/// the system-default account of the classification's purpose, then any active
/// Detail account of that purpose, then the designated chart code. Returns
/// `None` for `UnresolvedDifference` and when no designated account exists.
pub async fn resolve_designated_account(
    account_repo: &Arc<dyn AccountRepository>,
    classification: ResidualClassification,
) -> Result<Option<Account>, AppError> {
    let Some(purpose) = classification.account_purpose() else {
        return Ok(None);
    };
    let accounts = account_repo.list_all().await?;
    let active: Vec<&Account> = accounts
        .iter()
        .filter(|a| a.purpose == purpose && a.is_active)
        .collect();
    if let Some(a) = active.iter().find(|a| a.is_default) {
        return Ok(Some((*a).clone()));
    }
    if let Some(a) = active.iter().find(|a| a.category == AccountCategory::Detail) {
        return Ok(Some((*a).clone()));
    }
    if let Some(code) = designated_code(classification) {
        if let Some(a) = account_repo.find_by_code(code).await? {
            if a.is_active {
                return Ok(Some(a));
            }
        }
    }
    Ok(active.first().map(|a| (*a).clone()))
}

/// Read-only contract between the backend rule and the frontend UX: lists the
/// five classifications with their labels, whether they may be posted, whether
/// a confirmation is required, the purposes their accounts must carry, the
/// resolved designated account and the preview copy. The frontend renders the
/// wizard card and its Advanced-mode account filter from this response, so the
/// rule cannot drift between backend and UI.
pub struct GetResidualClassificationSpecUseCase {
    account_repo: Arc<dyn AccountRepository>,
}

impl GetResidualClassificationSpecUseCase {
    pub fn new(account_repo: Arc<dyn AccountRepository>) -> Self {
        Self { account_repo }
    }

    pub async fn execute(&self) -> Result<Vec<ResidualClassificationSpec>, AppError> {
        let mut specs = Vec::with_capacity(CLASSIFICATIONS.len());
        for classification in CLASSIFICATIONS {
            let allowed_purposes: Vec<String> = classification
                .account_purpose()
                .map(|p| vec![p.to_str().to_string()])
                .unwrap_or_default();
            let designated_account =
                resolve_designated_account(&self.account_repo, classification)
                    .await?
                    .map(|a| ResidualDesignatedAccountDto {
                        id: a.id.0.to_string(),
                        code: a.code,
                        name_ar: a.name_ar,
                    });
            specs.push(ResidualClassificationSpec {
                key: classification.as_str().to_string(),
                label_ar: classification.label_ar().to_string(),
                allows_posting: classification.allows_posting(),
                requires_confirmation: classification.requires_confirmation(),
                allowed_purposes,
                designated_account,
                treatment_ar: treatment_ar(classification).to_string(),
            });
        }
        Ok(specs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::account::{
        Account, AccountCategory, AccountPurpose, AccountType,
    };
    use domain::shared::currency::Currency;
    use rust_decimal::Decimal;

    use crate::mocks::MockAccountRepository;

    fn account(code: &str, purpose: AccountPurpose, is_default: bool) -> Account {
        let mut a = Account::new(
            code.to_string(),
            format!("حساب {}", code),
            format!("Account {}", code),
            AccountType::Equity,
            None,
            AccountCategory::Detail,
            2,
            Decimal::ZERO,
            Decimal::ZERO,
            Decimal::ZERO,
            Currency::new("SAR", "SAR", "ريال", "ر.س", 2, false),
            Decimal::ONE,
            None,
        )
        .unwrap()
        .with_purpose(purpose);
        a.is_default = is_default;
        a
    }

    async fn repo_with(accounts: Vec<Account>) -> Arc<dyn AccountRepository> {
        Arc::new(MockAccountRepository::from(accounts))
    }

    #[tokio::test]
    async fn every_real_classification_resolves_its_designated_account() {
        let repo = repo_with(vec![
            account("52", AccountPurpose::RetainedEarnings, true),
            account("521", AccountPurpose::OpeningEquityAdjustment, true),
            account("525", AccountPurpose::PriorPeriodAdjustment, true),
            account("526", AccountPurpose::OtherEquity, true),
        ])
        .await;
        for c in [
            ResidualClassification::RetainedEarnings,
            ResidualClassification::OpeningEquityAdjustment,
            ResidualClassification::PriorPeriodAdjustment,
            ResidualClassification::OtherEquity,
        ] {
            let a = resolve_designated_account(&repo, c).await.unwrap();
            assert_eq!(a.map(|a| a.code), designated_code(c).map(String::from), "{c:?}");
        }
    }

    #[tokio::test]
    async fn unresolved_difference_never_resolves_an_account() {
        let repo = repo_with(vec![]).await;
        assert_eq!(
            resolve_designated_account(&repo, ResidualClassification::UnresolvedDifference)
                .await
                .unwrap()
                .map(|a| a.id),
            None
        );
    }

    #[tokio::test]
    async fn missing_designated_account_resolves_none() {
        let repo = repo_with(vec![]).await;
        assert_eq!(
            resolve_designated_account(&repo, ResidualClassification::RetainedEarnings)
                .await
                .unwrap()
                .map(|a| a.id),
            None
        );
    }

    #[tokio::test]
    async fn spec_lists_all_classifications_with_matching_purposes() {
        let repo = repo_with(vec![
            account("52", AccountPurpose::RetainedEarnings, true),
            account("521", AccountPurpose::OpeningEquityAdjustment, true),
            account("525", AccountPurpose::PriorPeriodAdjustment, true),
            account("526", AccountPurpose::OtherEquity, true),
        ])
        .await;
        let specs = GetResidualClassificationSpecUseCase::new(repo)
            .execute()
            .await
            .unwrap();
        assert_eq!(specs.len(), 5);

        let retained = specs.iter().find(|s| s.key == "RetainedEarnings").unwrap();
        assert_eq!(retained.allowed_purposes, vec!["retained_earnings"]);
        assert!(retained.allows_posting);
        assert!(!retained.requires_confirmation);
        assert_eq!(retained.designated_account.as_ref().unwrap().code, "52");

        let prior = specs.iter().find(|s| s.key == "PriorPeriodAdjustment").unwrap();
        assert!(prior.requires_confirmation);

        let unresolved = specs.iter().find(|s| s.key == "UnresolvedDifference").unwrap();
        assert!(!unresolved.allows_posting);
        assert!(unresolved.allowed_purposes.is_empty());
        assert!(unresolved.designated_account.is_none());
    }
}