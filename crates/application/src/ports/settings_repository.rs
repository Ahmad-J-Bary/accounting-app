use async_trait::async_trait;
use domain::settings::CompanySettings;
use crate::errors::AppError;

#[async_trait]
pub trait SettingsRepository: Send + Sync {
    async fn get(&self) -> Result<CompanySettings, AppError>;
    async fn save(&self, settings: &CompanySettings) -> Result<(), AppError>;
}
