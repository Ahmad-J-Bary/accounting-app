use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::settings_repository::SettingsRepository;
use domain::settings::CompanySettings;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteSettingsRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteSettingsRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SettingsRepository for SqliteSettingsRepository {
    async fn get(&self) -> Result<CompanySettings, AppError> {
        queries::get(&self.pool).await
    }

    async fn save(&self, settings: &CompanySettings) -> Result<(), AppError> {
        commands::save(&self.pool, settings).await
    }
}
