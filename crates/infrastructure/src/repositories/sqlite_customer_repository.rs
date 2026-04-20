use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::customer_repository::CustomerRepository;
use domain::customers::Customer;
use domain::shared::CustomerId;
use std::sync::Arc;

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
        sqlx::query(
            "INSERT INTO customers (id, name, email, phone) VALUES (?, ?, ?, ?)"
        )
        .bind(customer.id.0.to_string())
        .bind(&customer.name)
        .bind(&customer.email)
        .bind(&customer.phone)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, _id: &CustomerId) -> Result<Option<Customer>, AppError> {
        // TODO: Implement database read
        Ok(None)
    }

    async fn list_all(&self) -> Result<Vec<Customer>, AppError> {
        // TODO: Implement database read
        Ok(vec![])
    }

    async fn delete(&self, _id: &CustomerId) -> Result<(), AppError> {
        // TODO: Implement database delete
        Ok(())
    }
}
