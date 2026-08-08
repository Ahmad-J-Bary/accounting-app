use std::sync::Arc;
use std::str::FromStr;
use domain::accounting::ResidualClassification;
use domain::shared::ids::AccountId;

use crate::errors::AppError;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::use_cases::opening_balance::types::SetResidualClassificationCommand;

/// Records the accountant's explicit classification of the residual equity of an
/// opening-balance migration. The system computes the residual but never decides
/// its nature; this is a deliberate accounting judgement (Sec 6 / Sec 8).
pub struct SetResidualClassificationUseCase {
    repo: Arc<dyn OpeningMigrationRepository>,
}

impl SetResidualClassificationUseCase {
    pub fn new(repo: Arc<dyn OpeningMigrationRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, cmd: SetResidualClassificationCommand) -> Result<(), AppError> {
        let classification = ResidualClassification::from_str(&cmd.classification)
            .ok_or_else(|| AppError::Invalid(format!("تصنيف غير معروف: {}", cmd.classification)))?;

        let residual_account_id = match &cmd.residual_account_id {
            Some(account_id) => Some(AccountId::from_str(account_id)
                .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?),
            None => None,
        };

        let mut migration = self.repo.find_by_id(&cmd.migration_id).await?
            .ok_or_else(|| AppError::NotFound("ترحيل الرصيد الافتتاحي غير موجود".into()))?;

        migration.set_residual_classification(Some(classification), residual_account_id);
        self.repo.update(&migration).await?;

        Ok(())
    }
}
