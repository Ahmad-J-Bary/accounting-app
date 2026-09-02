use crate::errors::AppError;
use async_trait::async_trait;
use domain::shared::Currency;

#[async_trait]
pub trait CurrencyRepository: Send + Sync {
    async fn save(&self, currency: &Currency) -> Result<(), AppError>;
    async fn set_base_currency(&self, code: &str) -> Result<(), AppError>;
    async fn find_by_code(&self, code: &str) -> Result<Option<Currency>, AppError>;
    async fn list_all(&self) -> Result<Vec<Currency>, AppError>;
    async fn list_active(&self) -> Result<Vec<Currency>, AppError>;
    async fn get_base_currency(&self) -> Result<Option<Currency>, AppError>;
    async fn delete(&self, code: &str) -> Result<(), AppError>;
}
