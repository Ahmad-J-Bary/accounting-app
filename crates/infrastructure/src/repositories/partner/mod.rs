use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::partner_repository::PartnerRepository;
use domain::accounting::account::Account;
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

    async fn save_with_accounts(
        &self,
        partner: &Partner,
        capital_account: &Account,
        drawings_account: &Account,
        current_account: Option<&Account>,
    ) -> Result<(), AppError> {
        commands::save_with_accounts(&self.pool, partner, capital_account, drawings_account, current_account).await
    }

    async fn update(&self, partner: &Partner) -> Result<(), AppError> {
        commands::update(&self.pool, partner).await
    }

    async fn update_with_accounts(
        &self,
        partner: &Partner,
        capital_replacement: Option<&Account>,
        drawings_replacement: Option<&Account>,
    ) -> Result<(), AppError> {
        commands::update_with_accounts(&self.pool, partner, capital_replacement, drawings_replacement).await
    }

    async fn delete(&self, id: &PartnerId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn delete_with_accounts(
        &self,
        id: &PartnerId,
        linked_account_ids: &[domain::shared::AccountId],
    ) -> Result<(), AppError> {
        commands::delete_with_accounts(&self.pool, id, linked_account_ids).await
    }
}
