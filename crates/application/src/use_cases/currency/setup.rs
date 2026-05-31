use std::sync::Arc;
use crate::dto::currency_dto::{CurrencyDto, CurrencyContextDto};
use crate::errors::AppError;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::ports::settings_repository::SettingsRepository;
use crate::world_currencies::{self, WorldCurrency};
use domain::shared::currency::Currency;
use domain::shared::exchange_rate::{ExchangeRate, RateType};
use chrono::Utc;
use rust_decimal::Decimal;

pub struct CurrencySetupUseCase {
    currency_repo: Arc<dyn CurrencyRepository>,
    rate_repo: Arc<dyn ExchangeRateRepository>,
    settings_repo: Arc<dyn SettingsRepository>,
}

impl CurrencySetupUseCase {
    pub fn new(
        currency_repo: Arc<dyn CurrencyRepository>,
        rate_repo: Arc<dyn ExchangeRateRepository>,
        settings_repo: Arc<dyn SettingsRepository>,
    ) -> Self {
        Self { currency_repo, rate_repo, settings_repo }
    }

    pub fn get_world_currencies(&self) -> Vec<WorldCurrency> {
        world_currencies::get_world_currencies()
    }

    pub async fn is_setup_complete(&self) -> Result<bool, AppError> {
        let active = self.currency_repo.list_active().await?;
        if active.is_empty() {
            return Ok(false);
        }
        if let Ok(settings) = self.settings_repo.get().await {
            if settings.company_name.trim().is_empty() {
                return Ok(false);
            }
        }
        Ok(true)
    }

    pub async fn setup_currencies(
        &self,
        base_code: &str,
        secondary_code: Option<&str>,
    ) -> Result<CurrencyContextDto, AppError> {
        let code = base_code.trim().to_uppercase();
        if code.len() < 3 {
            return Err(AppError::Invalid("رمز العملة الأساسية يجب أن يكون 3 أحرف على الأقل".to_string()));
        }

        let all = world_currencies::get_world_currencies();
        let base_info = all.iter().find(|c| c.code == code)
            .ok_or_else(|| AppError::Invalid(format!("العملة {} غير موجودة في القائمة العالمية", code)))?;

        let existing = self.currency_repo.list_all().await?;
        for c in existing {
            if c.code != code && secondary_code.as_ref().is_none_or(|s| c.code != s.trim().to_uppercase()) {
                self.currency_repo.delete(&c.code).await?;
            }
        }

        let base_currency = Currency::new(
            &base_info.code,
            &base_info.name_ar,
            &base_info.name_en,
            &base_info.symbol,
            base_info.decimals,
            true,
        );
        self.currency_repo.save(&base_currency).await?;
        self.currency_repo.set_base_currency(&code).await?;

        if let Some(sec) = secondary_code {
            let sec_code = sec.trim().to_uppercase();
            if sec_code != code {
                if let Some(sec_info) = all.iter().find(|c| c.code == sec_code) {
                    let sec_currency = Currency::new(
                        &sec_info.code,
                        &sec_info.name_ar,
                        &sec_info.name_en,
                        &sec_info.symbol,
                        sec_info.decimals,
                        false,
                    );
                    self.currency_repo.save(&sec_currency).await?;

                    let er = ExchangeRate::new(
                        &code,
                        &sec_code,
                        Decimal::ONE,
                        RateType::Middle,
                        Utc::now(),
                    );
                    self.rate_repo.save(&er).await?;
                }
            }
        }

        let active = self.currency_repo.list_active().await?;
        let base = active.iter().find(|c| c.is_base)
            .ok_or_else(|| AppError::NotFound("لم يتم العثور على العملة الأساسية".to_string()))?;
        Ok(CurrencyContextDto {
            base_currency_code: base.code.clone(),
            active_currencies: active.into_iter().map(|c| CurrencyDto {
                code: c.code,
                name: if !c.name_ar.trim().is_empty() { c.name_ar.clone() } else { c.name_en.clone() },
                name_ar: c.name_ar,
                name_en: c.name_en,
                symbol: c.symbol,
                decimals: c.decimals,
                is_base: c.is_base,
                is_active: c.is_active,
                notes: c.notes,
            }).collect(),
            today_status: vec![],
            last_updated_at: None,
        })
    }
}
