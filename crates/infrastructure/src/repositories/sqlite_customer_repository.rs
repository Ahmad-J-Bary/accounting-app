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

use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::DateTime;

#[derive(sqlx::FromRow)]
struct CustomerRow {
    id: String,
    name: String,
    email: Option<String>,
    phone: String,
    address: Option<String>,
    balance: String,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

fn row_to_customer(row: CustomerRow) -> Result<Customer, AppError> {
    Ok(Customer {
        id: CustomerId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        name: row.name,
        email: row.email,
        phone: row.phone,
        address: row.address,
        balance: Decimal::from_str(&row.balance).unwrap_or(Decimal::ZERO),
        is_active: row.is_active,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl CustomerRepository for SqliteCustomerRepository {
    async fn save(&self, customer: &Customer) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO customers (id, name, email, phone, address, balance, is_active, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(customer.id.to_string())
        .bind(&customer.name)
        .bind(&customer.email)
        .bind(&customer.phone)
        .bind(&customer.address)
        .bind(customer.balance.to_string())
        .bind(customer.is_active)
        .bind(customer.created_at.to_rfc3339())
        .bind(customer.updated_at.to_rfc3339())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &CustomerId) -> Result<Option<Customer>, AppError> {
        let row = sqlx::query_as::<_, CustomerRow>(
            "SELECT id, name, email, phone, address, balance, is_active, created_at, updated_at 
             FROM customers WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        row.map(row_to_customer).transpose()
    }

    async fn list_all(&self) -> Result<Vec<Customer>, AppError> {
        let rows = sqlx::query_as::<_, CustomerRow>(
            "SELECT id, name, email, phone, address, balance, is_active, created_at, updated_at 
             FROM customers ORDER BY name"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        rows.into_iter().map(row_to_customer).collect()
    }

    async fn update(&self, customer: &Customer) -> Result<(), AppError> {
        sqlx::query(
            "UPDATE customers SET name=?, email=?, phone=?, address=?, balance=?, is_active=?, updated_at=? 
             WHERE id=?"
        )
        .bind(&customer.name)
        .bind(&customer.email)
        .bind(&customer.phone)
        .bind(&customer.address)
        .bind(customer.balance.to_string())
        .bind(customer.is_active)
        .bind(customer.updated_at.to_rfc3339())
        .bind(customer.id.to_string())
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn delete(&self, id: &CustomerId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM customers WHERE id = ?")
            .bind(id.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}
