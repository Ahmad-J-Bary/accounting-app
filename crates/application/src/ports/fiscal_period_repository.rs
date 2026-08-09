use async_trait::async_trait;
use chrono::{DateTime, Utc};
use domain::accounting::fiscal_period::FiscalPeriod;
use domain::shared::ids::FiscalPeriodId;
use crate::errors::AppError;

#[async_trait]
pub trait FiscalPeriodRepository: Send + Sync {
    async fn create(&self, period: &FiscalPeriod) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &FiscalPeriodId) -> Result<Option<FiscalPeriod>, AppError>;
    async fn list(&self) -> Result<Vec<FiscalPeriod>, AppError>;
    /// All periods whose window contains `date` (used to detect overlaps when
    /// creating a new period and to find the active period for an entry date).
    async fn find_by_date(&self, date: DateTime<Utc>) -> Result<Vec<FiscalPeriod>, AppError>;
    /// Persists any status/close-metadata change.
    async fn update(&self, period: &FiscalPeriod) -> Result<(), AppError>;
}