use std::sync::Arc;
use rust_decimal::Decimal;
use chrono::Utc;
use domain::accounting::partner::{ProfitSharingType};
use domain::shared::ids::PartnerId;

use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::unit_of_work::UnitOfWork;
use crate::errors::AppError;

pub struct UpdatePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    uow: Arc<dyn UnitOfWork>,
}

pub struct UpdatePartnerRequest {
    pub id: String,
    pub name: String,
    pub exchange_rate: Decimal,
    pub amount: Decimal,
    pub is_amount_in_usd: bool,
    pub sharing_type: String,
    pub manual_ratio: Option<Decimal>,
}

impl UpdatePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        uow: Arc<dyn UnitOfWork>,
    ) -> Self {
        Self { repo, account_repo, uow }
    }

    pub async fn execute(
        &self,
        req: UpdatePartnerRequest,
    ) -> Result<(), AppError> {
        let partner_id = req.id.parse::<PartnerId>().map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;
        let mut partner = self.repo.find_by_id(&partner_id).await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        let sharing_enum = match req.sharing_type.as_str() {
            "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
            "BasedOnCapitalUSD" => ProfitSharingType::BasedOnCapitalUSD,
            "Manual" => ProfitSharingType::Manual,
            _ => return Err(AppError::Invalid("نوع تقاسم أرباح غير صالح".into())),
        };

        let old_name = partner.name.clone();

        partner.update_info(
            partner.code.clone(), // Keep same code for now
            req.name.clone(),
            req.exchange_rate,
            req.amount,
            req.is_amount_in_usd,
            sharing_enum,
            req.manual_ratio,
        ).map_err(AppError::Domain)?;

        self.uow.begin().await?;
        self.repo.update(&partner).await?;

        if old_name != req.name {
            if let Some(cap_id) = partner.linked_account_id {
                if let Some(mut acc) = self.account_repo.find_by_id(&cap_id).await? {
                    acc.name_ar = req.name.clone();
                    acc.name_en = req.name.clone();
                    acc.updated_at = Utc::now();
                    self.account_repo.save(&acc).await?;
                }
            }
            if let Some(draw_id) = partner.drawings_account_id {
                if let Some(mut acc) = self.account_repo.find_by_id(&draw_id).await? {
                    let draw_account_name = format!("مسحوبات {}", req.name);
                    acc.name_ar = draw_account_name.clone();
                    acc.name_en = draw_account_name;
                    acc.updated_at = Utc::now();
                    self.account_repo.save(&acc).await?;
                }
            }
        }

        self.uow.commit().await?;

        Ok(())
    }
}
