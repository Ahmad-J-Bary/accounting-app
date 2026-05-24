use std::sync::Arc;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::dto::currency_dto::{CreateCurrencyDto, SetExchangeRateDto, ExchangeRateDto, CurrencyDto, UpdateCurrencyDto};
use crate::errors::AppError;
use domain::shared::currency::Currency;
use domain::shared::exchange_rate::{ExchangeRate, RateType};
use chrono::Utc;
use rust_decimal::Decimal;
use std::str::FromStr;

pub struct CurrencyCommands {
    currency_repo: Arc<dyn CurrencyRepository>,
    rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl CurrencyCommands {
    pub fn new(
        currency_repo: Arc<dyn CurrencyRepository>,
        rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self { currency_repo, rate_repo }
    }

    pub async fn create_currency(&self, dto: CreateCurrencyDto) -> Result<CurrencyDto, AppError> {
        let normalized_code = dto.code.trim().to_uppercase();
        if normalized_code.len() < 3 {
            return Err(AppError::Invalid("رمز العملة يجب أن يكون 3 أحرف على الأقل".to_string()));
        }

        // If a soft-deleted currency exists, reactivate it
        if let Some(existing) = self.currency_repo.find_by_code(&normalized_code).await? {
            if existing.is_active {
                return Err(AppError::Invalid(format!("العملة {} موجودة بالفعل", dto.code)));
            }
            let updated = Currency {
                code: normalized_code.clone(),
                name_ar: dto.name_ar.trim().to_string(),
                name_en: dto.name_en.trim().to_string(),
                symbol: dto.symbol.trim().to_string(),
                decimals: dto.decimals,
                is_base: dto.is_base,
                is_active: true,
                notes: dto.notes.clone(),
            };
            if updated.is_base {
                self.currency_repo.set_base_currency(&normalized_code).await?;
            }
            self.currency_repo.save(&updated).await?;
            return self.to_currency_dto(updated);
        }

        let mut currency = Currency::new(
            &normalized_code,
            dto.name_ar.trim(),
            dto.name_en.trim(),
            dto.symbol.trim(),
            dto.decimals,
            dto.is_base,
        );
        currency.is_active = dto.is_active;
        currency.notes = dto.notes.clone();

        if dto.is_base {
            self.currency_repo.set_base_currency(&normalized_code).await?;
        }

        self.currency_repo.save(&currency).await?;

        self.to_currency_dto(currency)
    }

    pub async fn update_currency(&self, dto: UpdateCurrencyDto) -> Result<CurrencyDto, AppError> {
        let existing = self
            .currency_repo
            .find_by_code(&dto.code)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("العملة {} غير موجودة", dto.code)))?;

        if existing.is_base && !dto.is_active {
            return Err(AppError::Invalid("لا يمكن تعطيل العملة الأساسية".to_string()));
        }

        let mut updated = Currency {
            code: dto.code.trim().to_uppercase(),
            name_ar: dto.name_ar.trim().to_string(),
            name_en: dto.name_en.trim().to_string(),
            symbol: dto.symbol.trim().to_string(),
            decimals: dto.decimals,
            is_base: existing.is_base,
            is_active: dto.is_active,
            notes: dto.notes.clone(),
        };

        // Keep base currency always active.
        if updated.is_base {
            updated.is_active = true;
        }

        self.currency_repo.save(&updated).await?;
        self.to_currency_dto(updated)
    }

    pub async fn set_base_currency(&self, code: &str) -> Result<CurrencyDto, AppError> {
        let normalized = code.trim().to_uppercase();
        let currency = self
            .currency_repo
            .find_by_code(&normalized)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("العملة {} غير موجودة", normalized)))?;

        if !currency.is_active {
            return Err(AppError::Invalid("لا يمكن تعيين عملة غير مفعلة كعملة أساسية".to_string()));
        }

        self.currency_repo.set_base_currency(&normalized).await?;
        let updated = self
            .currency_repo
            .find_by_code(&normalized)
            .await?
            .ok_or_else(|| AppError::NotFound("فشل تحديث العملة الأساسية".to_string()))?;

        self.to_currency_dto(updated)
    }

    pub async fn delete_currency(&self, code: &str) -> Result<(), AppError> {
        // Prevent deleting the base currency
        if let Some(c) = self.currency_repo.find_by_code(code).await? {
            if c.is_base {
                return Err(AppError::Invalid("لا يمكن حذف العملة الأساسية".to_string()));
            }
        }
        self.currency_repo.delete(code).await
    }

    pub async fn set_exchange_rate(&self, dto: SetExchangeRateDto) -> Result<ExchangeRateDto, AppError> {
        let rate_decimal = Decimal::from_str(&dto.rate)
            .map_err(|_| AppError::Invalid("سعر الصرف غير صالح".to_string()))?;

        if rate_decimal <= Decimal::ZERO {
            return Err(AppError::Invalid("يجب أن يكون سعر الصرف أكبر من صفر".to_string()));
        }

        // Validate currencies exist
        let from = self.currency_repo.find_by_code(&dto.from_currency).await?
            .ok_or_else(|| AppError::NotFound(format!("العملة {} غير موجودة", dto.from_currency)))?;
        let to = self.currency_repo.find_by_code(&dto.to_currency).await?
            .ok_or_else(|| AppError::NotFound(format!("العملة {} غير موجودة", dto.to_currency)))?;

        if !from.is_active || !to.is_active {
            return Err(AppError::Invalid("يجب أن تكون العملات المختارة مفعلة".to_string()));
        }

        if !from.is_base {
            return Err(AppError::Invalid("يجب إدخال سعر الصرف انطلاقا من العملة الأساسية".to_string()));
        }

        if from.code == to.code {
            return Err(AppError::Invalid("لا يمكن إدخال سعر صرف لنفس العملة".to_string()));
        }

        let rate_type = match dto.rate_type.as_str() {
            "Purchase" => RateType::Purchase,
            "Sale" => RateType::Sale,
            "Closing" => RateType::Closing,
            "Reference" => RateType::Middle,
            _ => RateType::Middle,
        };

        let rate_date = chrono::DateTime::parse_from_rfc3339(&dto.rate_date)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let er = ExchangeRate::new(
            &dto.from_currency,
            &dto.to_currency,
            rate_decimal,
            rate_type,
            rate_date,
        );
        let mut er = er;
        er.source = dto.source.clone();
        er.user_id = dto.user_id.clone();
        self.rate_repo.save(&er).await?;

        Ok(ExchangeRateDto {
            id: er.id,
            from_currency: er.from_currency,
            to_currency: er.to_currency,
            rate: er.rate.to_string(),
            rate_type: dto.rate_type,
            rate_date: er.rate_date.to_rfc3339(),
            source: er.source,
            created_at: er.created_at.to_rfc3339(),
        })
    }

    fn to_currency_dto(&self, currency: Currency) -> Result<CurrencyDto, AppError> {
        let display_name = if !currency.name_ar.trim().is_empty() {
            currency.name_ar.clone()
        } else {
            currency.name_en.clone()
        };

        Ok(CurrencyDto {
            code: currency.code,
            name: display_name,
            name_ar: currency.name_ar,
            name_en: currency.name_en,
            symbol: currency.symbol,
            decimals: currency.decimals,
            is_base: currency.is_base,
            is_active: currency.is_active,
            notes: currency.notes,
        })
    }
}
