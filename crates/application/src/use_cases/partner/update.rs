use std::sync::Arc;
use rust_decimal::Decimal;
use chrono::Utc;
use domain::accounting::partner::ProfitSharingType;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Money, MonetaryAmount};
use domain::shared::ids::PartnerId;

use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::unit_of_work::UnitOfWork;
use crate::errors::AppError;

pub struct UpdatePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    uow: Arc<dyn UnitOfWork>,
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
}

impl UpdatePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        uow: Arc<dyn UnitOfWork>,
        currency_repo: Arc<dyn CurrencyRepository>,
    ) -> Self {
        Self { repo, account_repo, journal_repo, uow, currency_repo }
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
            "BasedOnCapitalOriginal" => ProfitSharingType::BasedOnCapitalOriginal,
            "Manual" => ProfitSharingType::Manual,
            _ => return Err(AppError::Invalid("نوع تقاسم أرباح غير صالح".into())),
        };

        let old_name = partner.name.clone();

        // If the currency changed, look up the new Currency entity.
        if req.currency_code != partner.currency.code {
            let base_currency = self.currency_repo.get_base_currency().await?
                .ok_or_else(|| AppError::Invalid("لم يتم تعيين العملة الأساسية".into()))?;
            let new_currency = if req.is_amount_in_original {
                self.currency_repo.find_by_code(&req.currency_code).await?
                    .ok_or_else(|| AppError::Invalid(format!("العملة {} غير موجودة", req.currency_code)))?
            } else {
                base_currency
            };
            partner.currency = new_currency;
        }

        partner.update_info(
            partner.code.clone(),
            req.name.clone(),
            req.exchange_rate,
            req.amount,
            req.is_amount_in_original,
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

        // Sync consolidated capital journal entry
        if let Ok(Some(old_entry)) = self.journal_repo.find_by_source_id("consolidated_capital").await {
            self.journal_repo.delete(&old_entry.id).await?;
        }

        let all_partners = self.repo.list_all(true).await?;
        let mut total_local = Decimal::ZERO;
        let mut total_original = Decimal::ZERO;
        for p in &all_partners {
            total_local += p.amount_local;
            total_original += p.amount_original;
        }

        if total_local > Decimal::ZERO || total_original > Decimal::ZERO {
            let cash_account = self.account_repo.find_by_code("122").await?
                .ok_or_else(|| AppError::NotFound("حساب الصندوق (الخزينة) (122) غير موجود".into()))?;
            let capital_parent = self.account_repo.find_by_code("222").await?
                .ok_or_else(|| AppError::Invalid("حساب رأس المال العام (222) غير موجود".into()))?;

            let base_currency = self.currency_repo.get_base_currency().await?
                .ok_or_else(|| AppError::Invalid("لم يتم تعيين العملة الأساسية".into()))?;
            let fx_rate = if req.exchange_rate > Decimal::ZERO { req.exchange_rate } else { Decimal::ONE };
            let total_ma = if req.is_amount_in_original || total_original > Decimal::ZERO {
                MonetaryAmount::new(Money::new(total_original.abs(), base_currency.clone()), fx_rate)
            } else {
                MonetaryAmount::new(Money::new(total_local.abs(), base_currency), fx_rate)
            };
            let zero_ma = MonetaryAmount::zero(total_ma.currency().clone());

            let lines = vec![
                JournalLine::new(cash_account.id, total_ma.clone(), zero_ma.clone(),
                    "إيداع رأس المال بالصندوق".to_string()),
                JournalLine::new(capital_parent.id, zero_ma, total_ma,
                    "إجمالي رأس مال الشركاء".to_string()),
            ];

            let mut entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                JournalType::CashOpeningBalance,
                lines,
                Utc::now(),
                "إيداع رأس المال بالصندوق — إجمالي رأس مال الشركاء".to_string(),
                Some("consolidated_capital".to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        self.uow.commit().await?;

        Ok(())
    }
}
