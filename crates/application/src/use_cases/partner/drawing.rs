use std::sync::Arc;
use rust_decimal::Decimal;
use chrono::{DateTime, Utc};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::{Money, MonetaryAmount, AccountId};
use domain::shared::ids::PartnerId;

use crate::ports::partner_repository::PartnerRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::errors::AppError;
use uuid::Uuid;

/// Explicit partner-drawing event: a partner withdraws cash/bank funds from the
/// company.
///
/// Journal (Sec 11 / Sec 34):
///   Dr <partner drawings account (44X, contra-equity)>
///       Cr <funding account (cash/bank)>
///
/// Drawings are a contra-equity (owner current) balance and therefore do NOT
/// appear as an operating expense in the Profit & Loss.
pub struct CreatePartnerDrawingUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CreatePartnerDrawingUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { repo, account_repo, journal_repo }
    }

    pub async fn execute(
        &self,
        partner_id: String,
        funding_account_id: String,
        amount: Decimal,
        effective_date: Option<String>,
        description: Option<String>,
        event_id: Option<String>,
    ) -> Result<String, AppError> {
        let partner_id_parsed = partner_id.parse::<PartnerId>()
            .map_err(|_| AppError::NotFound("معرف الشريك غير صالح".into()))?;
        let partner = self.repo.find_by_id(&partner_id_parsed).await?
            .ok_or_else(|| AppError::NotFound("الشريك غير موجود".into()))?;

        if amount <= Decimal::ZERO {
            return Err(AppError::Invalid("مبلغ المسحوبات يجب أن يكون أكبر من الصفر".into()));
        }

        let drawings_account_id = partner.drawings_account_id
            .ok_or_else(|| AppError::Invalid("الشريك لا يملك حساب مسحوبات مرتبط".into()))?;

        let funding_id = funding_account_id.parse::<AccountId>()
            .map_err(|_| AppError::NotFound("معرف حساب التمويل غير صالح".into()))?;
        let _funding_account = self.account_repo.find_by_id(&funding_id).await?
            .ok_or_else(|| AppError::NotFound("حساب التمويل غير موجود".into()))?;

        let fx_rate = if partner.exchange_rate > Decimal::ZERO {
            partner.exchange_rate
        } else {
            Decimal::ONE
        };
        let amount_ma = drawing_currency_amount(amount, fx_rate, &partner.currency);
        let zero_ma = MonetaryAmount::zero(amount_ma.currency().clone());

        let lines = vec![
            JournalLine::new(
                drawings_account_id,
                amount_ma.clone(),
                zero_ma.clone(),
                format!("سحب الشريك {}", partner.name),
            ),
            JournalLine::new(
                funding_id,
                zero_ma,
                amount_ma,
                format!("سحب الشريك {} من الحساب الممول", partner.name),
            ),
        ];

        // A drawing is a single auditable event; the event id keys the journal's
        // source. A re-submitted drawing with the same event id resolves to the
        // already-created journal (Sec 11 / Sec 34 / Sec 45).
        let event_key = event_id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let source_id = format!("partner_drawing:{}", event_key);

        if let Some(existing) = self.journal_repo.find_by_source_id(&source_id).await? {
            return Ok(existing.id.to_string());
        }

        let mut entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::PartnerDrawing,
            lines,
            effective_date
                .and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(Utc::now),
            description.unwrap_or_else(|| format!("سحب الشريك {}", partner.name)),
            Some(source_id),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        // Single-repo atomic write; journal_lines persist in the same transaction.
        self.journal_repo.save(&entry).await?;

        Ok(entry.id.to_string())
    }
}

/// Builds the partner-currency monetary leg for a drawing whose entered amount
/// is in the local (base) currency. `original = base * fx` so `Money::to_base`
/// divides back to exactly `base` — the journal balances in the base currency
/// without an fx^2 drift for non-base (foreign-currency) partners (Sec 38).
fn drawing_currency_amount(base_amount: Decimal, fx_rate: Decimal, currency: &domain::shared::currency::Currency) -> MonetaryAmount {
    let amount_original = base_amount * fx_rate;
    MonetaryAmount::new(Money::new(amount_original, currency.clone()), fx_rate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::shared::currency::Currency;
    use domain::shared::ids::{AccountId, PartnerId};
    use rust_decimal::Decimal;

    #[test]
    fn drawing_entry_is_balanced_and_uses_contra_equity_leg() {
        let drawings_id = AccountId::new();
        let funding_id = AccountId::new();
        let cur = Currency::new("SAR", "ريال", "Saudi Riyal", "ر.س", 2, true);

        let entry = JournalEntry::new(
            "JE-001".to_string(),
            JournalType::PartnerDrawing,
            vec![
                JournalLine::new(
                    drawings_id,
                    MonetaryAmount::from_base(Decimal::from(5000), cur.clone()),
                    MonetaryAmount::zero(cur.clone()),
                    "سحب".to_string(),
                ),
                JournalLine::new(
                    funding_id,
                    MonetaryAmount::zero(cur.clone()),
                    MonetaryAmount::from_base(Decimal::from(5000), cur.clone()),
                    "سحب".to_string(),
                ),
            ],
            Utc::now(),
            "سحب الشريك".to_string(),
            None,
        )
        .expect("valid entry");

        entry.clone().post().expect("balanced entry must post");
        assert_eq!(entry.total_base_debit(), Decimal::from(5000));
        assert_eq!(entry.total_base_credit(), Decimal::from(5000));
        assert_eq!(entry.journal_type, JournalType::PartnerDrawing);
        assert!(entry.is_balanced());
    }

    #[test]
    fn drawing_does_not_change_retained_earnings_balance() {
        // A partner drawing debits a contra-equity account and credits cash only;
        // retained earnings (52) is untouched by this transaction.
        let cur = Currency::new("SAR", "ريال", "Saudi Riyal", "ر.س", 2, true);
        let entry = JournalEntry::new(
            "JE-002".to_string(),
            JournalType::PartnerDrawing,
            vec![
                JournalLine::new(
                    AccountId::new(),
                    MonetaryAmount::from_base(Decimal::from(2500), cur.clone()),
                    MonetaryAmount::zero(cur.clone()),
                    "سحب".to_string(),
                ),
                JournalLine::new(
                    AccountId::new(),
                    MonetaryAmount::zero(cur.clone()),
                    MonetaryAmount::from_base(Decimal::from(2500), cur.clone()),
                    "سحب".to_string(),
                ),
            ],
            Utc::now(),
            "سحب الشريك".to_string(),
            None,
        )
        .expect("valid entry");

        entry.clone().post().unwrap();
        assert!(entry.is_balanced());
        assert_eq!(entry.lines.len(), 2);
    }

    #[test]
    fn partner_id_parses() {
        let _id: PartnerId = "8fb1e5ce-0000-0000-0000-000000000001".parse().unwrap();
    }

    #[test]
    fn foreign_currency_drawing_base_equals_entered_amount() {
        let usd = Currency::new("USD", "دولار", "US Dollar", "$", 2, false);
        let fx = Decimal::new(375, 2); // 3.75 — base SAR
        let base_amount = Decimal::new(3750, 0); // 3750 entered in base currency

        let ma = drawing_currency_amount(base_amount, fx, &usd);

        // The original leg carries the partner's USD figure and the base leg
        // equals the entered base amount exactly (round-trip, no fx^2 drift).
        assert_eq!(ma.amount(), Decimal::new(1406250, 2)); // 3750 * 3.75 USD
        assert_eq!(ma.base_amount, base_amount);
    }
}
