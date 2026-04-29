use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::partner_repository::PartnerRepository;
use domain::accounting::partner::{Partner};
use domain::shared::ids::{PartnerId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqlitePartnerRepository {
    pool: Arc<SqlitePool>,
}

impl SqlitePartnerRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PartnerRepository for SqlitePartnerRepository {
    async fn find_by_id(&self, id: &PartnerId) -> Result<Option<Partner>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self, include_inactive: bool) -> Result<Vec<Partner>, AppError> {
        queries::list_all(&self.pool, include_inactive).await
    }

    async fn save(&self, partner: &Partner) -> Result<(), AppError> {
        commands::save(&self.pool, partner).await
    }

    async fn update(&self, partner: &Partner) -> Result<(), AppError> {
        commands::update(&self.pool, partner).await
    }

    async fn delete(&self, id: &PartnerId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }
}
