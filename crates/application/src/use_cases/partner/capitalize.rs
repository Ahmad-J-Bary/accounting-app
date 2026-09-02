use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::ids::PartnerId;
use domain::shared::{MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::partner_repository::PartnerRepository;
use uuid::Uuid;

/// Capitalizes a portion of the company's retained earnings (52) into a
/// partner's capital account through an explicit, auditable journal (Sec 10).
///
/// Journal:
///   Dr <retained earnings (52)>
///       Cr <partner capital (51X)>
pub struct CapitalizeRetainedEarningsUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CapitalizeRetainedEarningsUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(
        &self,
        partner_id: String,
        amount: Decimal,
        effective_date: Option<String>,
        event_id: Option<String>,
    ) -> Result<String, AppError> {
        let partner_id_parsed = partner_id
            .parse::<PartnerId>()
            .map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;
        let partner = self
            .repo
            .find_by_id(&partner_id_parsed)
            .await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        if amount <= Decimal::ZERO {
            return Err(AppError::Invalid(
                "مبلغ الرسملة يجب أن يكون أكبر من الصفر".into(),
            ));
        }

        let capital_account_id = partner
            .linked_account_id
            .ok_or_else(|| AppError::Invalid("الشريك لا يملك حساب رأس مال مرتبط".into()))?;

        let retained = self
            .account_repo
            .find_by_code("52")
            .await?
            .ok_or_else(|| AppError::NotFound("حساب الأرباح المبقاة (52) غير موجود".into()))?;

        let fx_rate = if partner.exchange_rate > Decimal::ZERO {
            partner.exchange_rate
        } else {
            Decimal::ONE
        };
        let amount_ma = capitalization_currency_amount(amount, fx_rate, &partner.currency);
        let zero_ma = MonetaryAmount::zero(amount_ma.currency().clone());

        let lines = vec![
            JournalLine::new(
                retained.id,
                amount_ma.clone(),
                zero_ma.clone(),
                format!("رسملة الأرباح المبقاة — الشريك {}", partner.name),
            ),
            JournalLine::new(
                capital_account_id,
                zero_ma,
                amount_ma,
                format!("زيادة رأس المال بالرسملة — الشريك {}", partner.name),
            ),
        ];

        // A capitalization is a single auditable event; the event id keys the
        // journal's source so a re-submission resolves to the existing journal
        // (Sec 10 / Sec 45).
        let event_key = event_id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let source_id = format!("capitalization:{}", event_key);

        if let Some(existing) = self.journal_repo.find_by_source_id(&source_id).await? {
            return Ok(existing.id.to_string());
        }

        let mut entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::Capitalization,
            lines,
            effective_date
                .and_then(|d| chrono::DateTime::parse_from_rfc3339(&d).ok())
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(Utc::now),
            format!("رسملة الأرباح المبقاة — الشريك {}", partner.name),
            Some(source_id),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        // Journal lines persist atomically with the entry (single transaction).
        self.journal_repo.save(&entry).await?;

        Ok(entry.id.to_string())
    }
}

/// Builds the partner-currency monetary leg for a capitalization whose entered
/// amount is in the local (base) currency. `original = base * fx` so
/// `Money::to_base` divides back to exactly `base` — no fx^2 drift for
/// non-base partners (Sec 38).
fn capitalization_currency_amount(
    base_amount: Decimal,
    fx_rate: Decimal,
    currency: &domain::shared::currency::Currency,
) -> MonetaryAmount {
    let amount_original = base_amount * fx_rate;
    MonetaryAmount::new(Money::new(amount_original, currency.clone()), fx_rate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::shared::currency::Currency;
    use domain::shared::ids::PartnerId;
    use domain::shared::AccountId;

    #[test]
    fn capitalization_reduces_retained_and_credits_capital() {
        let cur = Currency::new("SAR", "ريال", "Saudi Riyal", "ر.س", 2, true);
        let retained_id = AccountId::new();
        let capital_id = AccountId::new();

        let entry = JournalEntry::new(
            "JE-CAP-001".to_string(),
            JournalType::Capitalization,
            vec![
                JournalLine::new(
                    retained_id,
                    MonetaryAmount::from_base(Decimal::from(12000), cur.clone()),
                    MonetaryAmount::zero(cur.clone()),
                    "رسملة".to_string(),
                ),
                JournalLine::new(
                    capital_id,
                    MonetaryAmount::zero(cur.clone()),
                    MonetaryAmount::from_base(Decimal::from(12000), cur.clone()),
                    "رسملة".to_string(),
                ),
            ],
            Utc::now(),
            "رسملة الأرباح المبقاة".to_string(),
            None,
        )
        .expect("valid entry");

        entry.clone().post().unwrap();
        assert!(entry.is_balanced());
        assert_eq!(entry.total_base_debit(), Decimal::from(12000));
        assert_eq!(entry.total_base_credit(), Decimal::from(12000));
        assert_eq!(entry.journal_type, JournalType::Capitalization);
    }

    #[test]
    fn partner_id_round_trip() {
        let _id: PartnerId = "8fb1e5ce-0000-0000-0000-000000000002".parse().unwrap();
    }

    #[test]
    fn foreign_currency_capitalization_base_equals_entered_amount() {
        let usd = Currency::new("USD", "دولار", "US Dollar", "$", 2, false);
        let fx = Decimal::new(375, 2); // 3.75 — base SAR
        let base_amount = Decimal::new(12000, 0); // 12000 entered in base currency

        let ma = capitalization_currency_amount(base_amount, fx, &usd);

        assert_eq!(ma.amount(), Decimal::new(4500000, 2)); // 12000 * 3.75 USD
        assert_eq!(ma.base_amount, base_amount);
    }
}
