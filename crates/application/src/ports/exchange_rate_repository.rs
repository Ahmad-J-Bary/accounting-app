use crate::errors::AppError;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::shared::exchange_rate::{ExchangeRate, RateType};

#[async_trait]
pub trait ExchangeRateRepository: Send + Sync {
    async fn save(&self, rate: &ExchangeRate) -> Result<(), AppError>;
    async fn find_latest(
        &self,
        from: &str,
        to: &str,
        rate_type: RateType,
    ) -> Result<Option<ExchangeRate>, AppError>;
    async fn find_at_date(
        &self,
        from: &str,
        to: &str,
        date: DateTime<Utc>,
        rate_type: RateType,
    ) -> Result<Option<ExchangeRate>, AppError>;
    async fn list_history(
        &self,
        from: &str,
        to: &str,
        limit: i32,
    ) -> Result<Vec<ExchangeRate>, AppError>;
}
