use async_trait::async_trait;
use domain::shared::ids::{CustomerId, AccountId};
use crate::errors::AppError;
use domain::customers::Customer;

#[async_trait]
pub trait CustomerRepository: Send + Sync {
    async fn save(&self, customer: &Customer) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &CustomerId) -> Result<Option<Customer>, AppError>;
    async fn find_by_account_id(&self, account_id: &AccountId) -> Result<Option<Customer>, AppError>;
    async fn list_all(&self) -> Result<Vec<Customer>, AppError>;
    async fn update(&self, customer: &Customer) -> Result<(), AppError>;
    async fn delete(&self, id: &CustomerId) -> Result<(), AppError>;
}
