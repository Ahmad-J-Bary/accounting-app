use std::sync::Arc;
use rust_decimal::Decimal;
use chrono::Utc;
use domain::shared::ids::PartnerId;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Money, MonetaryAmount};
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::unit_of_work::UnitOfWork;
use crate::errors::AppError;

pub struct DeletePartnerUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    uow: Arc<dyn UnitOfWork>,
    currency_repo: Arc<dyn CurrencyRepository>,
}

impl DeletePartnerUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        uow: Arc<dyn UnitOfWork>,
        currency_repo: Arc<dyn CurrencyRepository>,
    ) -> Self {
        Self { repo, account_repo, journal_repo, uow, currency_repo }
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

        // Rebuild consolidated capital entry
        if let Ok(Some(old_entry)) = self.journal_repo.find_by_source_id("consolidated_capital").await {
            self.journal_repo.delete(&old_entry.id).await?;
        }

        let remaining = self.repo.list_all(true).await?;
        let mut total_local = Decimal::ZERO;
        let mut total_original = Decimal::ZERO;
        for p in &remaining {
            total_local += p.amount_local;
            total_original += p.amount_original;
        }

        if total_local > Decimal::ZERO || total_original > Decimal::ZERO {
            if let (Ok(Some(cash_account)), Ok(Some(_capital_parent))) = (
                self.account_repo.find_by_code("122").await,
                self.account_repo.find_by_code("51").await,
            ) {
                let base_currency = self.currency_repo.get_base_currency().await?
                    .ok_or_else(|| AppError::Invalid("لم يتم تعيين العملة الأساسية".into()))?;
                let total_ma = MonetaryAmount::new(Money::new(total_local.abs(), base_currency.clone()), Decimal::ONE);
                let zero_ma = MonetaryAmount::zero(total_ma.currency().clone());

                let mut lines = Vec::new();
                lines.push(JournalLine::new(cash_account.id, total_ma.clone(), zero_ma.clone(),
                    "إيداع رأس المال بالصندوق".to_string()));

                for p in &remaining {
                    if p.amount_local > Decimal::ZERO || p.amount_original > Decimal::ZERO {
                        let p_fx_rate = if p.exchange_rate > Decimal::ZERO { p.exchange_rate } else { Decimal::ONE };
                        let p_ma = MonetaryAmount::new(Money::new(p.amount_local.abs(), p.currency.clone()), p_fx_rate);
                        let p_zero_ma = MonetaryAmount::zero(p_ma.currency().clone());

                        if let Some(cap_acc_id) = p.linked_account_id {
                            lines.push(JournalLine::new(
                                cap_acc_id,
                                p_zero_ma,
                                p_ma,
                                format!("حصة الشريك {} في رأس المال", p.name),
                            ));
                        }
                    }
                }

                if let Ok(mut entry) = JournalEntry::new(
                    self.journal_repo.get_next_entry_number().await?,
                    JournalType::CashOpeningBalance,
                    lines,
                    Utc::now(),
                    "إيداع رأس المال بالصندوق — رأس مال الشركاء التفصيلي".to_string(),
                    Some("consolidated_capital".to_string()),
                ) {
                    let _ = entry.post();
                    let _ = self.journal_repo.save(&entry).await;
                }
            }
        }

        self.uow.commit().await?;
        Ok(())
    }
}
