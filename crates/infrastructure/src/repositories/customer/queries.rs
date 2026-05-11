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

pub async fn get_next_customer_number(pool: &SqlitePool) -> Result<i32, AppError> {
    // Find the next available customer number starting from 1
    // (0 is reserved for cash customer: 1230)
    let mut num = 1;
    loop {
        // Check if this number exists in customers table or in accounts table with code like "123{num}"
        let customer_exists: Option<(i32,)> = sqlx::query_as::<_, (i32,)>(
            "SELECT 1 FROM customers WHERE code = ? LIMIT 1"
        )
        .bind(num.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let account_exists: Option<(i32,)> = sqlx::query_as::<_, (i32,)>(
            "SELECT 1 FROM accounts WHERE code = ? LIMIT 1"
        )
        .bind(format!("123{}", num))
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if customer_exists.is_none() && account_exists.is_none() {
            return Ok(num);
        }
        num += 1;
        if num > 10000 {
            return Err(AppError::Infrastructure("Cannot find available customer number".into()));
        }
    }
}
