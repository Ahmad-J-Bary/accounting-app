use std::sync::Arc;
use domain::shared::ids::PartnerId;
use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::errors::AppError;

pub struct DeletePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl DeletePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, account_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let partner_id = id.parse::<PartnerId>().map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;
        
        let partner = self.repo.find_by_id(&partner_id).await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        // Collect the linked accounts (capital + drawings) so the whole
        // partner + accounts removal is atomic in a single transaction.
        let mut linked = Vec::new();
        if let Some(cap_id) = partner.linked_account_id {
            linked.push(cap_id);
        }
        if let Some(draw_id) = partner.drawings_account_id {
            linked.push(draw_id);
        }
        if let Some(curr_id) = partner.current_account_id {
            if !linked.contains(&curr_id) {
                linked.push(curr_id);
            }
        }

        self.repo.delete_with_accounts(&partner_id, &linked).await?;
        Ok(())
    }
}