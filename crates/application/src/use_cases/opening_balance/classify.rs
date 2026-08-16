use std::sync::Arc;
use std::str::FromStr;
use domain::accounting::ResidualClassification;
use domain::shared::ids::AccountId;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::SetResidualClassificationCommand;

/// Records the accountant's explicit classification of the residual equity of an
/// opening-balance migration. The system computes the residual but never decides
/// its nature; this is a deliberate accounting judgement (Sec 6 / Sec 8).
///
/// The residual is an equity clearing item, so the chosen target account must be
/// an equity-type account carrying an acceptable passive purpose (Retained
/// Earnings / Opening Balance Equity / General / Partner Current). Routing it to
/// an operating, sub-ledger or registered-capital account is rejected up front.
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

        let residual_account_id = match &cmd.residual_account_id {
            Some(account_id) => Some(AccountId::from_str(account_id)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?),
            None => None,
        };

        if let Some(account_id) = residual_account_id {
            let account = self.account_repo.find_by_id(&account_id).await?
                .ok_or_else(|| AppError::NotFound(format!("الحساب غير موجود: {account_id}")))?;
            if account.account_type != domain::accounting::account::AccountType::Equity
                || !account.purpose.is_residual_classification_target()
            {
                return Err(AppError::Invalid(
                    "حساب تصنيف الرصيد المتبقي يجب أن يكون من حسابات حقوق الملكية (أرباح مبقاة / رصيد افتتاحي / عام / جاري شريك) وليس من الأصول أو المصاريف أو رأس المال المسجل"
                        .into(),
                ));
            }
        }

        let mut migration = self.repo.find_by_id(&cmd.migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        migration.set_residual_classification(Some(classification), residual_account_id);
        self.repo.update(&migration).await?;

        Ok(())
    }
}