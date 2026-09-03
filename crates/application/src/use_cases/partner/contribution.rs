use chrono::Utc;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::shared::ids::PartnerId;
use domain::shared::{AccountId, MonetaryAmount, Money};
use rust_decimal::Decimal;
use std::sync::Arc;

use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::opening_migration_repository::OpeningMigrationRepository;
use crate::ports::partner_repository::PartnerRepository;
use crate::use_cases::opening_balance::opening_window_active;
use crate::use_cases::shared::fiscal_lifecycle::FiscalLifecyclePolicy;
use uuid::Uuid;

/// Explicit capital contribution: a partner contributes funds/assets to the
/// company. This is a real financial event and is intentionally kept separate
/// from partner master-data creation (see CreatePartnerUseCase, which no longer
/// posts any journal entry).
///
/// Journal:  Dr <funding account> / Cr <partner capital>
///
/// An existing-company partner's historical capital is NOT a cash contribution:
/// while an opening-balance migration window is open this event is rejected so
/// cash never increases just by registering historical capital (Sec 5).
pub struct CreateCapitalContributionUseCase {
    repo: Arc<dyn PartnerRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
    fiscal_year_repo: Arc<dyn FiscalYearRepository>,
    fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl CreateCapitalContributionUseCase {
    pub fn new(
        repo: Arc<dyn PartnerRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        opening_migration_repo: Arc<dyn OpeningMigrationRepository>,
        fiscal_year_repo: Arc<dyn FiscalYearRepository>,
        fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
    ) -> Self {
        Self {
            repo,
            account_repo,
            journal_repo,
            opening_migration_repo,
            fiscal_year_repo,
            fiscal_period_repo,
        }
    }

    pub async fn execute(
        &self,
        partner_id: String,
        funding_account_id: String,
        amount: Decimal,
        is_amount_in_original: bool,
        event_id: Option<String>,
    ) -> Result<String, AppError> {
        if opening_window_active(&self.opening_migration_repo).await? {
            return Err(AppError::Forbidden(
                "لا يمكن تسجيل مساهمة رأس مال نقدية أثناء فترة الرصيد الافتتاحي — رأس مال الشركة القائمة يُسجَّل كرصيد افتتاحي تاريخي دون زيادة النقدية"
                    .into(),
            ));
        }

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
                "مبلغ مساهمة رأس المال يجب أن يكون أكبر من الصفر".into(),
            ));
        }

        let capital_account_id = partner
            .linked_account_id
            .ok_or_else(|| AppError::Invalid("الشريك لا يملك حساب رأس مال مرتبط".into()))?;

        let funding_id = funding_account_id
            .parse::<AccountId>()
            .map_err(|_| AppError::NotFound("معرف حساب التمويل غير صالح".into()))?;
        let _funding_account = self
            .account_repo
            .find_by_id(&funding_id)
            .await?
            .ok_or_else(|| AppError::NotFound("حساب التمويل غير موجود".into()))?;

        // Build the contribution monetary amount in the partner's own currency
        // and exchange rate so the journal balances in both original and base.
        let fx_rate = if partner.exchange_rate > Decimal::ZERO {
            partner.exchange_rate
        } else {
            Decimal::ONE
        };
        let amount_ma =
            contribution_currency_amount(amount, fx_rate, &partner.currency, is_amount_in_original);
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

        // A capital contribution is a single auditable event. The event id keys
        // the journal's source ({type}:{event}); a caller-provided id means a
        // re-submission of the same event resolves to the already-created
        // journal instead of double-posting (Sec 10 / Sec 45).
        let event_key = event_id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let source_id = format!("capital_contribution:{}", event_key);

        let effective_date = Utc::now();
        FiscalLifecyclePolicy::new(self.fiscal_year_repo.clone(), self.fiscal_period_repo.clone())
            .validate_normal_operational(None, effective_date)
            .await?;

        if let Some(existing) = self.journal_repo.find_by_source_id(&source_id).await? {
            return Ok(existing.id.to_string());
        }

        let mut entry = JournalEntry::new(
            self.journal_repo.get_next_entry_number().await?,
            JournalType::CapitalContribution,
            lines,
            effective_date,
            format!("مساهمة رأس مال — الشريك {}", partner.name),
            Some(source_id),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        // The journal repository persists the entry atomically (single write);
        // journal_lines are written in the same transaction.
        self.journal_repo.save(&entry).await?;

        Ok(entry.id.to_string())
    }
}

/// Builds the partner-currency monetary leg for a capital contribution.
///
/// * `is_amount_in_original == true`: the caller entered the amount in the
///   partner's own currency → original = amount, base = amount / fx.
/// * `false`: the amount is entered in the local (base) currency → original =
///   amount * fx so `Money::to_base` yields exactly `amount` (no fx^2 drift;
///   Sec 38).
fn contribution_currency_amount(
    amount: Decimal,
    fx_rate: Decimal,
    currency: &domain::shared::currency::Currency,
    is_amount_in_original: bool,
) -> MonetaryAmount {
    let amount_original = if is_amount_in_original {
        amount
    } else {
        amount * fx_rate
    };
    MonetaryAmount::new(Money::new(amount_original, currency.clone()), fx_rate)
}

#[cfg(test)]
mod tests {
    use super::*;
    use domain::shared::currency::Currency;

    #[test]
    fn foreign_currency_contribution_from_base_equals_entered_amount() {
        let usd = Currency::new("USD", "دولار", "US Dollar", "$", 2, false);
        let fx = Decimal::new(375, 2); // 3.75 — base SAR
        let base_amount = Decimal::new(20000, 0); // 20000 entered in base currency

        let ma = contribution_currency_amount(base_amount, fx, &usd, false);

        assert_eq!(
            ma.base_amount, base_amount,
            "base leg must equal the entered base amount"
        );
        assert_eq!(ma.amount(), Decimal::new(7500000, 2)); // 20000 * 3.75 USD
    }

    #[test]
    fn foreign_currency_contribution_in_original_converts_to_base() {
        let usd = Currency::new("USD", "دولار", "US Dollar", "$", 2, false);
        let fx = Decimal::new(375, 2); // 3.75 — base SAR
        let original_amount = Decimal::new(1000, 0); // 1000 USD

        let ma = contribution_currency_amount(original_amount, fx, &usd, true);

        assert_eq!(ma.amount(), original_amount);
        assert_eq!(
            ma.base_amount.round_dp(2),
            Decimal::new(26667, 2), // 1000 / 3.75 ≈ 266.67
        );
    }

    #[test]
    fn base_currency_contribution_is_unchanged_at_rate_one() {
        let sar = Currency::new("SAR", "ريال", "Saudi Riyal", "ر.س", 2, true);
        let amount = Decimal::new(5000, 0);

        let ma = contribution_currency_amount(amount, Decimal::ONE, &sar, false);

        assert_eq!(ma.amount(), amount);
        assert_eq!(ma.base_amount, amount);
    }
}
