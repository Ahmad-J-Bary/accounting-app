use async_trait::async_trait;
use core_domain::accounting::account::Account;
use core_domain::shared::AccountId;
use crate::errors::AppError;

#[async_trait]
pub trait AccountRepository: Send + Sync {
    async fn save(&self, account: &Account) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &AccountId) -> Result<Option<Account>, AppError>;
    async fn find_by_code(&self, code: &str) -> Result<Option<Account>, AppError>;
    async fn list_all(&self) -> Result<Vec<Account>, AppError>;
    async fn delete(&self, id: &AccountId) -> Result<(), AppError>;
}
