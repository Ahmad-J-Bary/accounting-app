use crate::errors::AppError;
use crate::ports::partner_repository::PartnerRepository;
use domain::shared::ids::PartnerId;
use std::sync::Arc;

pub struct DeletePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
}

impl DeletePartnerUseCase {
    pub fn new(repo: Arc<dyn PartnerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let partner_id = id
            .parse::<PartnerId>()
            .map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;

        let _partner = self
            .repo
            .find_by_id(&partner_id)
            .await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        // Delete only the partner record. Linked accounts stay in the chart
        // of accounts — journal_lines.account_id has a FK to accounts(id)
        // without ON DELETE CASCADE, so deleting the accounts first would
        // fail with a FOREIGN KEY constraint violation.
        self.repo.delete(&partner_id).await?;
        Ok(())
    }
}
