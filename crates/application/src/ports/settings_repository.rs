use crate::errors::AppError;
use async_trait::async_trait;
use domain::settings::CompanySettings;

#[async_trait]
pub trait SettingsRepository: Send + Sync {
    async fn get(&self) -> Result<CompanySettings, AppError>;
    async fn save(&self, settings: &CompanySettings) -> Result<(), AppError>;
}
