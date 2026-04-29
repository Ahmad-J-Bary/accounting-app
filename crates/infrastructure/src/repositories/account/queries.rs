use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::account::{Account};
use domain::shared::ids::{AccountId};
use super::models::AccountRow;
use super::mappers::row_to_account;

pub async fn find_by_id(pool: &SqlitePool, id: &AccountId) -> Result<Option<Account>, AppError> {
    let row = sqlx::query_as::<_, AccountRow>("SELECT * FROM accounts WHERE id = ?")
        .bind(id.0.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_account).transpose()
}

pub async fn find_by_code(pool: &SqlitePool, code: &str) -> Result<Option<Account>, AppError> {
    let row = sqlx::query_as::<_, AccountRow>("SELECT * FROM accounts WHERE code = ?")
        .bind(code)
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_account).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Account>, AppError> {
    let rows = sqlx::query_as::<_, AccountRow>("SELECT * FROM accounts ORDER BY code ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut accounts = Vec::new();
    for row in rows {
        accounts.push(row_to_account(row)?);
    }
    Ok(accounts)
}
