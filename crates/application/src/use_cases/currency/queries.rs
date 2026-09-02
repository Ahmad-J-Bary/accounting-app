use crate::dto::currency_dto::{
    CurrencyContextDto, CurrencyDto, ExchangeRateDto, TodayRateStatusDto,
};
use crate::errors::AppError;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use chrono::Utc;
use domain::shared::exchange_rate::RateType;
use std::sync::Arc;

pub struct CurrencyQueries {
    currency_repo: Arc<dyn CurrencyRepository>,
    rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl CurrencyQueries {
    pub fn new(
        currency_repo: Arc<dyn CurrencyRepository>,
        rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self {
            currency_repo,
            rate_repo,
        }
    }

    pub async fn list_all(&self) -> Result<Vec<CurrencyDto>, AppError> {
        let currencies = self.currency_repo.list_all().await?;
        Ok(currencies.into_iter().map(Self::to_currency_dto).collect())
    }

    pub async fn list_active(&self) -> Result<Vec<CurrencyDto>, AppError> {
        let currencies = self.currency_repo.list_active().await?;
        Ok(currencies.into_iter().map(Self::to_currency_dto).collect())
    }

    pub async fn get_today_rates_status(&self) -> Result<Vec<TodayRateStatusDto>, AppError> {
        let base = self
            .currency_repo
            .get_base_currency()
            .await?
            .ok_or_else(|| AppError::Invalid("لا توجد عملة أساسية معرفة".to_string()))?;

        let currencies = self.currency_repo.list_active().await?;

        let mut result = vec![];
        for c in currencies {
            if c.is_base {
                continue;
            }

            let latest = self.rate_repo.list_history(&base.code, &c.code, 1).await?;
            let today_rate = self
                .rate_repo
                .find_at_date(&base.code, &c.code, Utc::now(), RateType::Middle)
                .await?;

            let has_rate_today = today_rate.is_some();
            let rate = today_rate.as_ref().map(|r| r.rate.to_string());
            let rate_type = today_rate.as_ref().map(|r| format!("{:?}", r.rate_type));
            let (last_rate, last_rate_date) = latest
                .first()
                .map(|r| {
                    (
                        Some(r.rate.to_string()),
                        Some(r.rate_date.format("%Y-%m-%d").to_string()),
                    )
                })
                .unwrap_or((None, None));

            result.push(TodayRateStatusDto {
                currency_code: c.code.clone(),
                currency_name_ar: c.name_ar.clone(),
                currency_name_en: c.name_en.clone(),
                currency_symbol: c.symbol.clone(),
                has_rate_today,
                rate,
                rate_type,
                last_rate,
                last_rate_date,
            });
        }
        Ok(result)
    }

    pub async fn list_rate_history(
        &self,
        from: &str,
        to: &str,
        limit: i32,
    ) -> Result<Vec<ExchangeRateDto>, AppError> {
        let rates = self.rate_repo.list_history(from, to, limit).await?;
        Ok(rates
            .into_iter()
            .map(|r| ExchangeRateDto {
                id: r.id,
                from_currency: r.from_currency,
                to_currency: r.to_currency,
                rate: r.rate.to_string(),
                rate_type: format!("{:?}", r.rate_type),
                rate_date: r.rate_date.to_rfc3339(),
                source: r.source,
                created_at: r.created_at.to_rfc3339(),
            })
            .collect())
    }
    pub async fn get_latest_rate(&self, from: &str, to: &str) -> Result<Option<String>, AppError> {
        let history = self.rate_repo.list_history(from, to, 1).await?;
        Ok(history.first().map(|r| r.rate.to_string()))
    }

    pub async fn get_currency_context(&self) -> Result<CurrencyContextDto, AppError> {
        let active = self.list_active().await?;
        let today_status = self.get_today_rates_status().await?;
        let base_currency_code = active
            .iter()
            .find(|c| c.is_base)
            .map(|c| c.code.clone())
            .ok_or_else(|| AppError::Invalid("لا توجد عملة أساسية معرفة".to_string()))?;

        let last_updated_at = today_status
            .iter()
            .filter_map(|s| s.last_rate_date.clone())
            .max();

        Ok(CurrencyContextDto {
            base_currency_code,
            active_currencies: active,
            today_status,
            last_updated_at,
        })
    }

    fn to_currency_dto(c: domain::shared::currency::Currency) -> CurrencyDto {
        CurrencyDto {
            code: c.code,
            name: if !c.name_ar.trim().is_empty() {
                c.name_ar.clone()
            } else {
                c.name_en.clone()
            },
            name_ar: c.name_ar,
            name_en: c.name_en,
            symbol: c.symbol,
            decimals: c.decimals,
            is_base: c.is_base,
            is_active: c.is_active,
            notes: c.notes,
        }
    }
}
