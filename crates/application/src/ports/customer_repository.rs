use async_trait::async_trait;
use domain::shared::CustomerId;
use crate::errors::AppError;

#[derive(Debug, Clone)]
pub struct Customer {
    pub id: CustomerId,
    pub name: String,
    pub email: String,
    pub phone: String,
}

#[async_trait]
pub trait CustomerRepository: Send + Sync {
    async fn save(&self, customer: &Customer) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &CustomerId) -> Result<Option<Customer>, AppError>;
    async fn list_all(&self) -> Result<Vec<Customer>, AppError>;
    async fn delete(&self, id: &CustomerId) -> Result<(), AppError>;
}
