use sqlx::SqlitePool;
use application::errors::AppError;
use domain::suppliers::Supplier;
use domain::shared::ids::SupplierId;
use domain::shared::AccountId;
use super::models::SupplierRow;
use super::mappers::row_to_supplier;

pub async fn find_by_id(pool: &SqlitePool, id: &SupplierId) -> Result<Option<Supplier>, AppError> {
    let row = sqlx::query_as::<_, SupplierRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at
         FROM suppliers WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_supplier).transpose()
}

pub async fn find_by_account_id(pool: &SqlitePool, account_id: &AccountId) -> Result<Option<Supplier>, AppError> {
    let row = sqlx::query_as::<_, SupplierRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at
         FROM suppliers WHERE account_id = ?"
    )
    .bind(account_id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_supplier).transpose()
}

pub async fn find_by_name(pool: &SqlitePool, name: &str) -> Result<Vec<Supplier>, AppError> {
    let rows = sqlx::query_as::<_, SupplierRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at
         FROM suppliers WHERE name LIKE ?"
    )
    .bind(format!("%{}%", name))
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_supplier).collect()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Supplier>, AppError> {
    let rows = sqlx::query_as::<_, SupplierRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
         FROM suppliers ORDER BY name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_supplier).collect()
}

pub async fn get_next_supplier_number(pool: &SqlitePool) -> Result<i32, AppError> {
    // Find the next available supplier number starting from 1
    // (0 is reserved for cash supplier: 2230)
    let mut num = 1;
    loop {
        let supplier_exists: Option<(i32,)> = sqlx::query_as::<_, (i32,)>(
            "SELECT 1 FROM suppliers WHERE code = ? LIMIT 1"
        )
        .bind(num.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let account_exists: Option<(i32,)> = sqlx::query_as::<_, (i32,)>(
            "SELECT 1 FROM accounts WHERE code = ? LIMIT 1"
        )
        .bind(format!("223{}", num))
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if supplier_exists.is_none() && account_exists.is_none() {
            return Ok(num);
        }
        num += 1;
        if num > 10000 {
            return Err(AppError::Infrastructure("Cannot find available supplier number".into()));
        }
    }
}
