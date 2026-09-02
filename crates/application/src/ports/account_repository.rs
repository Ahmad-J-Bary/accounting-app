use crate::errors::AppError;
use async_trait::async_trait;
use domain::accounting::account::Account;
use domain::shared::AccountId;

#[async_trait]
pub trait AccountRepository: Send + Sync {
    async fn save(&self, account: &Account) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &AccountId) -> Result<Option<Account>, AppError>;
    async fn find_by_code(&self, code: &str) -> Result<Option<Account>, AppError>;
    async fn list_all(&self) -> Result<Vec<Account>, AppError>;
    async fn delete(&self, id: &AccountId) -> Result<(), AppError>;
    async fn get_next_child_code(&self, parent_code: &str) -> Result<String, AppError>;
}
