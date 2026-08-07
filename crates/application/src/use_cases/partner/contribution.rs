use std::sync::Arc;
use rust_decimal::Decimal;
use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Money, MonetaryAmount, AccountId};
use domain::shared::ids::PartnerId;

use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::unit_of_work::UnitOfWork;
use crate::errors::AppError;

/// Explicit capital contribution: a partner contributes funds/assets to the
/// company. This is a real financial event and is intentionally kept separate
/// from partner master-data creation (see CreatePartnerUseCase, which no longer
/// posts any journal entry).
///
/// Journal:  Dr <funding account> / Cr <partner capital>
pub struct CreateCapitalContributionUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    uow: Arc<dyn UnitOfWork>,
}

impl CreateCapitalContributionUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        uow: Arc<dyn UnitOfWork>,
    ) -> Self {
        Self { repo, account_repo, journal_repo, uow }
    }

    pub async fn execute(
        &self,
        partner_id: String,
        funding_account_id: String,
        amount: Decimal,
        is_amount_in_original: bool,
    ) -> Result<String, AppError> {
        let partner_id_parsed = partner_id.parse::<PartnerId>()
            .map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;
        let partner = self.repo.find_by_id(&partner_id_parsed).await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        if amount <= Decimal::ZERO {
            return Err(AppError::Invalid("مبلغ مساهمة رأس المال يجب أن يكون أكبر من الصفر".into()));
        }

        let capital_account_id = partner.linked_account_id
            .ok_or_else(|| AppError::Invalid("الشريك لا يملك حساب رأس مال مرتبط".into()))?;

        let funding_id = funding_account_id.parse::<AccountId>()
            .map_err(|_| AppError::NotFound("معرف حساب التمويل غير صالح".into()))?;
        let _funding_account = self.account_repo.find_by_id(&funding_id).await?
            .ok_or_else(|| AppError::NotFound("حساب التمويل غير موجود".into()))?;

        // Build the contribution monetary amount in the partner's own currency
        // and exchange rate so the journal balances in both original and base.
        let fx_rate = if partner.exchange_rate > Decimal::ZERO {
            partner.exchange_rate
        } else {
            Decimal::ONE
        };
        let amount_original = if is_amount_in_original {
            amount
        } else {
            amount / fx_rate
        };
        let amount_ma = MonetaryAmount::new(
            Money::new(amount_original, partner.currency.clone()),
            fx_rate,
        );
        let zero_ma = MonetaryAmount::zero(amount_ma.currency().clone());

        let lines = vec![
            JournalLine::new(
                funding_id,
                amount_ma.clone(),
                zero_ma.clone(),
                format!("إيداع رأس المال — الشريك {}", partner.name),
            ),
            JournalLine::new(
                capital_account_id,
                zero_ma,
                amount_ma,
                format!("مساهمة رأس مال الشريك {}", partner.name),
            ),
        ];

        self.uow.begin().await?;

        let mut entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::CapitalContribution,
            lines,
            Utc::now(),
            format!("مساهمة رأس مال — الشريك {}", partner.name),
            Some(format!("capital_contribution:{}", partner.id)),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        self.journal_repo.save(&entry).await?;

        self.uow.commit().await?;

        Ok(entry.id.to_string())
    }
}