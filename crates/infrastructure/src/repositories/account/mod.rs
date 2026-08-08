use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use domain::accounting::account::{Account};
use domain::shared::ids::{AccountId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

/// Serializes an account purpose for database storage (shared by the partner
/// repository's atomic account inserts).
pub fn purpose_to_str(purpose: domain::accounting::account::AccountPurpose) -> &'static str {
    commands::purpose_to_str(purpose)
}

pub struct SqliteAccountRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteAccountRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AccountRepository for SqliteAccountRepository {
    async fn save(&self, account: &Account) -> Result<(), AppError> {
        commands::save(&self.pool, account).await
    }

    async fn find_by_id(&self, id: &AccountId) -> Result<Option<Account>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_code(&self, code: &str) -> Result<Option<Account>, AppError> {
        queries::find_by_code(&self.pool, code).await
    }

    async fn list_all(&self) -> Result<Vec<Account>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn delete(&self, id: &AccountId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn get_next_child_code(&self, parent_code: &str) -> Result<String, AppError> {
        queries::get_next_child_code(&self.pool, parent_code).await
    }
}
