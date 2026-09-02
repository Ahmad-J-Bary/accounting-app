use domain::accounting::account::Account;
use domain::accounting::ResidualClassification;
use domain::shared::ids::AccountId;
use std::str::FromStr;
use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::classification_spec::resolve_designated_account;
use crate::use_cases::opening_balance::types::SetResidualClassificationCommand;

/// Records the accountant's explicit classification of the residual equity of an
/// opening-balance migration. The system computes the residual but never decides
/// its nature; this is a deliberate accounting judgement (Sec 6 / Sec 8).
///
/// The user chooses the ACCOUNTING MEANING, the system chooses the
/// appropriate ACCOUNT:
///   * When `residual_account_id` is absent, the designated account of the
///     classification's single controlled purpose is resolved automatically
///     (Retained Earnings → 52, Opening Equity Adjustment → 521, Prior Period
///     Adjustment → 525, Other Equity → 526). If no designated account exists,
///     the request is rejected with a pointer to Advanced mode.
///   * When an account IS supplied (explicit Advanced mode), it must be an
///     Equity account carrying exactly that classification's purpose —
///     partner-current or arbitrary equity accounts are rejected.
///   * `UnresolvedDifference` never carries an account and blocks posting and
///     locking (see post.rs / state.rs).
pub struct SetResidualClassificationUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl SetResidualClassificationUseCase {
    pub fn new(
        repo: Arc<dyn OpeningMigrationRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, account_repo }
    }

    pub async fn execute(&self, cmd: SetResidualClassificationCommand) -> Result<(), AppError> {
        let classification = ResidualClassification::from_str(&cmd.classification)
            .ok_or_else(|| AppError::Invalid(format!("تصنيف غير معروف: {}", cmd.classification)))?;

        let residual_account_id =
            resolve_target(&self.account_repo, classification, &cmd.residual_account_id).await?;

        let mut migration = self
            .repo
            .find_by_id(&cmd.migration_id)
            .await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        migration.set_residual_classification(Some(classification), residual_account_id);
        self.repo.update(&migration).await?;

        Ok(())
    }
}

/// Resolves and validates the residual target account for a classification.
/// Returns `Some(id)` when the classification posts to an account (auto-resolved
/// or Advanced-supplied), `None` for `UnresolvedDifference`.
async fn resolve_target(
    account_repo: &Arc<dyn AccountRepository>,
    classification: ResidualClassification,
    supplied: &Option<String>,
) -> Result<Option<AccountId>, AppError> {
    // UnresolvedDifference NEVER carries an account: accepting one here would
    // smuggle a balance into the ledger under a classification that must block.
    if classification == ResidualClassification::UnresolvedDifference {
        if supplied.is_some() {
            return Err(AppError::Invalid(
                "تصنيف «فرق غير محلول» لا يعتمد حساباً — لا يمكن ترحيل الفرق غير المحلول إلى حساب"
                    .into(),
            ));
        }
        return Ok(None);
    }

    let Some(account_id) = supplied else {
        // Auto-mode: resolve the designated account for the classification.
        return match resolve_designated_account(account_repo, classification).await? {
            Some(account) => {
                if !account_carries_classification(&account, classification) {
                    return Err(AppError::Invalid(format!(
                        "الحساب المخصص «{}» لا يحمل الغرض المطلوب للتصنيف «{}»",
                        account.name_ar,
                        classification.label_ar()
                    )));
                }
                Ok(Some(account.id))
            }
            None => Err(AppError::Invalid(format!(
                "لا يوجد حساب مخصص للتصنيف «{}» — أنشئ حساباً بالغرض المحدد أو استخدم الوضع المتقدم لاختيار حساب صالح",
                classification.label_ar()
            ))),
        };
    };

    let account = account_repo
        .find_by_id(
            &AccountId::from_str(account_id)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?,
        )
        .await?
        .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {account_id}")))?;

    if !account_carries_classification(&account, classification) {
        return Err(AppError::Invalid(format!(
            "حساب «{}» غير صالح لتصنيف «{}» — الحساب يجب أن يكون من حقوق الملكية بالغرض المحدد ({}). اختر حساباً صالحاً أو أغلق الوضع المتقدم",
            account.name_ar,
            classification.label_ar(),
            classification
                .account_purpose()
                .map(|p| p.to_str())
                .unwrap_or("—"),
        )));
    }

    Ok(Some(account.id))
}

/// An account is a valid target for a classification iff it is Equity-typed and
/// carries EXACTLY the classification's controlled purpose (the residual is an
/// equity clearing item — cash, banks, revenue/expenses, customers, suppliers,
/// inventory, fixed assets and registered partner capital are all excluded).
fn account_carries_classification(
    account: &Account,
    classification: ResidualClassification,
) -> bool {
    let Some(purpose) = classification.account_purpose() else {
        return false;
    };
    account.account_type == domain::accounting::account::AccountType::Equity
        && account.purpose == purpose
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::accounting::account::{Account, AccountCategory, AccountPurpose, AccountType};
    use domain::accounting::opening_balance::{OpeningBalanceLine, ResidualClassification};
    use domain::shared::currency::Currency;
    use rust_decimal::Decimal;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    use crate::mocks::{MockAccountRepository, MockOpeningMigrationRepository};

    fn sample_migration(id: &str) -> domain::accounting::opening_balance::OpeningBalanceMigration {
        domain::accounting::opening_balance::OpeningBalanceMigration::new(
            id.to_string(),
            chrono::Utc::now(),
            None,
            vec![OpeningBalanceLine {
                account_id: AccountId(Uuid::new_v4()),
                amount: dec!(100),
                description: None,
            }],
        )
        .unwrap()
    }

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

    #[tokio::test]
    async fn auto_resolves_designated_account_for_retained_earnings() {
        let account_repo: Arc<dyn AccountRepository> =
            Arc::new(MockAccountRepository::from(vec![account(
                "52",
                AccountPurpose::RetainedEarnings,
                true,
            )]));
        let migration_repo: Arc<dyn OpeningMigrationRepository> =
            Arc::new(MockOpeningMigrationRepository::default());
        let migration_id = "mig-auto";
        migration_repo
            .create(&sample_migration(migration_id))
            .await
            .unwrap();

        SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
            .execute(SetResidualClassificationCommand {
                migration_id: migration_id.to_string(),
                classification: "RetainedEarnings".into(),
                residual_account_id: None,
            })
            .await
            .unwrap();

        let saved = migration_repo
            .find_by_id(migration_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            saved.residual_classification,
            Some(ResidualClassification::RetainedEarnings)
        );
        assert!(
            saved.residual_account_id.is_some(),
            "auto-mode must resolve an account"
        );
    }

    #[tokio::test]
    async fn missing_designated_account_is_rejected() {
        let account_repo: Arc<dyn AccountRepository> =
            Arc::new(MockAccountRepository::from(vec![]));
        let migration_repo: Arc<dyn OpeningMigrationRepository> =
            Arc::new(MockOpeningMigrationRepository::default());
        let migration_id = "mig-no-account";
        migration_repo
            .create(&sample_migration(migration_id))
            .await
            .unwrap();

        let err =
            SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
                .execute(SetResidualClassificationCommand {
                    migration_id: migration_id.to_string(),
                    classification: "PriorPeriodAdjustment".into(),
                    residual_account_id: None,
                })
                .await
                .unwrap_err();
        assert!(
            err.to_string().contains("وضع متقدم") || err.to_string().contains("مخصص"),
            "missing designated account must be rejected clearly: {}",
            err
        );
    }

    #[tokio::test]
    async fn advanced_account_with_wrong_purpose_is_rejected() {
        let partner_current = account("5401", AccountPurpose::PartnerCurrent, false);
        let account_repo: Arc<dyn AccountRepository> =
            Arc::new(MockAccountRepository::from(vec![partner_current.clone()]));
        let migration_repo: Arc<dyn OpeningMigrationRepository> =
            Arc::new(MockOpeningMigrationRepository::default());
        let migration_id = "mig-wrong-purpose";
        migration_repo
            .create(&sample_migration(migration_id))
            .await
            .unwrap();

        let err =
            SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
                .execute(SetResidualClassificationCommand {
                    migration_id: migration_id.to_string(),
                    classification: "RetainedEarnings".into(),
                    residual_account_id: Some(partner_current.id.0.to_string()),
                })
                .await
                .unwrap_err();
        assert!(
            err.to_string().contains("غير صالح"),
            "partner-current target for RetainedEarnings must be rejected: {}",
            err
        );
    }

    #[tokio::test]
    async fn operating_account_is_rejected_as_target() {
        let cash = account("1201", AccountPurpose::General, false);
        let mut cash = cash;
        cash.account_type = AccountType::Assets;
        let account_repo: Arc<dyn AccountRepository> =
            Arc::new(MockAccountRepository::from(vec![cash.clone()]));
        let migration_repo: Arc<dyn OpeningMigrationRepository> =
            Arc::new(MockOpeningMigrationRepository::default());
        let migration_id = "mig-cash";
        migration_repo
            .create(&sample_migration(migration_id))
            .await
            .unwrap();

        let err =
            SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
                .execute(SetResidualClassificationCommand {
                    migration_id: migration_id.to_string(),
                    classification: "RetainedEarnings".into(),
                    residual_account_id: Some(cash.id.0.to_string()),
                })
                .await
                .unwrap_err();
        assert!(
            err.to_string().contains("غير صالح"),
            "cash account target must be rejected: {}",
            err
        );
    }

    #[tokio::test]
    async fn unresolved_difference_never_accepts_an_account() {
        let retained = account("52", AccountPurpose::RetainedEarnings, true);
        let account_repo: Arc<dyn AccountRepository> =
            Arc::new(MockAccountRepository::from(vec![retained.clone()]));
        let migration_repo: Arc<dyn OpeningMigrationRepository> =
            Arc::new(MockOpeningMigrationRepository::default());
        let migration_id = "mig-unresolved";
        migration_repo
            .create(&sample_migration(migration_id))
            .await
            .unwrap();

        let err =
            SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
                .execute(SetResidualClassificationCommand {
                    migration_id: migration_id.to_string(),
                    classification: "UnresolvedDifference".into(),
                    residual_account_id: Some(retained.id.0.to_string()),
                })
                .await
                .unwrap_err();
        assert!(
            err.to_string().contains("غير محلول"),
            "UnresolvedDifference with a supplied account must be rejected: {}",
            err
        );

        // Without an account it is accepted (no target).
        SetResidualClassificationUseCase::new(migration_repo.clone(), account_repo.clone())
            .execute(SetResidualClassificationCommand {
                migration_id: migration_id.to_string(),
                classification: "UnresolvedDifference".into(),
                residual_account_id: None,
            })
            .await
            .unwrap();
        let saved = migration_repo
            .find_by_id(migration_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            saved.residual_classification,
            Some(ResidualClassification::UnresolvedDifference)
        );
        assert!(saved.residual_account_id.is_none());
    }
}
