use std::sync::Arc;
use domain::shared::ids::PartnerId;
use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::unit_of_work::UnitOfWork;
use crate::errors::AppError;

pub struct DeletePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    uow: Arc<dyn UnitOfWork>,
}

impl DeletePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        uow: Arc<dyn UnitOfWork>,
    ) -> Self {
        Self { repo, account_repo, uow }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let partner_id = id.parse::<PartnerId>().map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;
        
        let partner = self.repo.find_by_id(&partner_id).await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        self.uow.begin().await?;

        self.repo.delete(&partner_id).await?;

        if let Some(cap_id) = partner.linked_account_id {
            let _ = self.account_repo.delete(&cap_id).await;
        }
        if let Some(draw_id) = partner.drawings_account_id {
            let _ = self.account_repo.delete(&draw_id).await;
        }

        self.uow.commit().await?;
        Ok(())
    }
}