use sqlx::SqlitePool;
use application::errors::AppError;
use domain::customers::Customer;
use domain::shared::{CustomerId, AccountId};
use super::models::CustomerRow;
use super::mappers::row_to_customer;

pub async fn find_by_id(pool: &SqlitePool, id: &CustomerId) -> Result<Option<Customer>, AppError> {
    let row = sqlx::query_as::<_, CustomerRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
         FROM customers WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_customer).transpose()
}

pub async fn find_by_account_id(pool: &SqlitePool, account_id: &AccountId) -> Result<Option<Customer>, AppError> {
    let row = sqlx::query_as::<_, CustomerRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
         FROM customers WHERE account_id = ?"
    )
    .bind(account_id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_customer).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Customer>, AppError> {
    let rows = sqlx::query_as::<_, CustomerRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
         FROM customers ORDER BY name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_customer).collect()
}
