use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::account_repository::AccountRepository;
use domain::accounting::account::Account;
use domain::shared::AccountId;
use std::sync::Arc;

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
        sqlx::query(
            "INSERT INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(account.id.0.to_string())
        .bind(&account.code)
        .bind(&account.name_ar)
        .bind(&account.name_en)
        .bind(format!("{:?}", account.account_type))
        .bind(account.parent_id.as_ref().map(|id| id.0.to_string()))
        .bind(account.balance.to_string())
        .bind(account.is_active)
        .bind(account.created_at)
        .bind(account.updated_at)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, _id: &AccountId) -> Result<Option<Account>, AppError> {
        // TODO: Implement database read
        Ok(None)
    }

    async fn find_by_code(&self, _code: &str) -> Result<Option<Account>, AppError> {
        // TODO: Implement database read
        Ok(None)
    }

    async fn list_all(&self) -> Result<Vec<Account>, AppError> {
        // TODO: Implement database read
        Ok(vec![])
    }

    async fn delete(&self, _id: &AccountId) -> Result<(), AppError> {
        // TODO: Implement database delete
        Ok(())
    }
}
