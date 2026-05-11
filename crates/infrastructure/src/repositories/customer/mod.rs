use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::customer_repository::CustomerRepository;
use domain::customers::Customer;
use domain::shared::{CustomerId, AccountId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteCustomerRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCustomerRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CustomerRepository for SqliteCustomerRepository {
    async fn save(&self, customer: &Customer) -> Result<(), AppError> {
        commands::save(&self.pool, customer).await
    }

    async fn find_by_id(&self, id: &CustomerId) -> Result<Option<Customer>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_account_id(&self, account_id: &AccountId) -> Result<Option<Customer>, AppError> {
        queries::find_by_account_id(&self.pool, account_id).await
    }

    async fn list_all(&self) -> Result<Vec<Customer>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn update(&self, customer: &Customer) -> Result<(), AppError> {
        commands::save(&self.pool, customer).await
    }

    async fn delete(&self, id: &CustomerId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn get_next_customer_number(&self) -> Result<i32, AppError> {
        queries::get_next_customer_number(&self.pool).await
    }
}
