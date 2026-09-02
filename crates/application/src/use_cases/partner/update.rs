use chrono::Utc;
use domain::accounting::partner::ProfitSharingType;
use domain::settings::START_MODE_EXISTING;
use domain::shared::ids::PartnerId;
use rust_decimal::Decimal;
use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::partner_repository::PartnerRepository;

pub struct UpdatePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
}

pub struct UpdatePartnerRequest {
    pub id: String,
    pub name: String,
    pub currency_code: String,
    pub exchange_rate: Decimal,
    pub amount: Decimal,
    pub is_amount_in_original: bool,
    pub sharing_type: String,
    pub manual_ratio: Option<Decimal>,
    pub notes: Option<String>,
}

impl UpdatePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
    ) -> Self {
        Self {
            repo,
            account_repo,
            currency_repo,
        }
    }

    pub async fn execute(
        &self,
        req: UpdatePartnerRequest,
        accounting_start_mode: String,
    ) -> Result<(), AppError> {
        let partner_id = req
            .id
            .parse::<PartnerId>()
            .map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;
        let mut partner = self
            .repo
            .find_by_id(&partner_id)
            .await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        let sharing_enum = match req.sharing_type.as_str() {
            "BasedOnCapitalLocal" => ProfitSharingType::BasedOnCapitalLocal,
            "BasedOnCapitalOriginal" => ProfitSharingType::BasedOnCapitalOriginal,
            "Manual" => ProfitSharingType::Manual,
            _ => return Err(AppError::Invalid("نوع تقاسم أرباح غير صالح".into())),
        };

        let old_name = partner.name.clone();

        // If the currency changed, look up the new Currency entity.
        if req.currency_code != partner.currency.code {
            let base_currency = self
                .currency_repo
                .get_base_currency()
                .await?
                .ok_or_else(|| AppError::Invalid("لم يتم تعيين العملة الأساسية".into()))?;
            let new_currency = if req.is_amount_in_original {
                self.currency_repo
                    .find_by_code(&req.currency_code)
                    .await?
                    .ok_or_else(|| {
                        AppError::Invalid(format!("العملة {} غير موجودة", req.currency_code))
                    })?
            } else {
                base_currency
            };
            partner.currency = new_currency;
        }

        partner
            .update_info(
                partner.code.clone(),
                req.name.clone(),
                req.exchange_rate,
                req.amount,
                req.is_amount_in_original,
                sharing_enum,
                req.manual_ratio,
                req.notes,
            )
            .map_err(AppError::Domain)?;

        // Resolve renamed linked accounts + (existing-company) capital amount
        // re-sync BEFORE the transaction so reads are part of the decision; the
        // write is then atomic in one tx.
        let mut capital_replacement = None;
        let mut drawings_replacement = None;
        let mut current_replacement = None;
        let sync_capital_amount = accounting_start_mode == START_MODE_EXISTING;
        if old_name != req.name || sync_capital_amount {
            if let Some(cap_id) = partner.linked_account_id {
                if let Some(mut acc) = self.account_repo.find_by_id(&cap_id).await? {
                    if old_name != req.name {
                        acc.name_ar = req.name.clone();
                        acc.name_en = req.name.clone();
                    }
                    // Existing-company registered capital lives as the capital
                    // account's static opening balance (create.rs books it with
                    // "no journal"); re-sync it so partner.amount_local always
                    // equals capital.opening_balance (Sec 4 / Sec 13).
                    if sync_capital_amount {
                        acc.opening_balance = partner.amount_local;
                        acc.balance = partner.amount_local + acc.debit - acc.credit;
                    }
                    acc.updated_at = Utc::now();
                    capital_replacement = Some(acc);
                }
            }
            if old_name != req.name {
                if let Some(draw_id) = partner.drawings_account_id {
                    if let Some(mut acc) = self.account_repo.find_by_id(&draw_id).await? {
                        let draw_account_name = format!("مسحوبات {}", req.name);
                        acc.name_ar = draw_account_name.clone();
                        acc.name_en = draw_account_name;
                        acc.updated_at = Utc::now();
                        drawings_replacement = Some(acc);
                    }
                }
                if let Some(cur_id) = partner.current_account_id {
                    if let Some(mut acc) = self.account_repo.find_by_id(&cur_id).await? {
                        let cur_account_name = format!("حساب جاري {}", req.name);
                        acc.name_ar = cur_account_name.clone();
                        acc.name_en = cur_account_name;
                        acc.updated_at = Utc::now();
                        current_replacement = Some(acc);
                    }
                }
            }
        }

        self.repo
            .update_with_accounts(
                &partner,
                capital_replacement.as_ref(),
                drawings_replacement.as_ref(),
                current_replacement.as_ref(),
            )
            .await?;

        Ok(())
    }
}
