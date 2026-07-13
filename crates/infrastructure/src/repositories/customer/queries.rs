use sqlx::SqlitePool;
use application::errors::AppError;
use domain::customers::Customer;
use domain::shared::{CustomerId, AccountId};

use super::models::CustomerRow;
use super::mappers::row_to_customer;

pub async fn find_by_id(pool: &SqlitePool, id: &CustomerId) -> Result<Option<Customer>, AppError> {
    let row = sqlx::query_as::<_, CustomerRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
         FROM customers WHERE id = ?
         UNION ALL
         SELECT 
            a.id, 
            CASE WHEN a.code LIKE '123%' THEN SUBSTR(a.code, 4) ELSE a.code END as code,
            a.name_ar as name, '' as phone, '' as address, a.id as account_id,
            a.debit as debit, a.credit as credit,             a.opening_balance, CAST(CAST(a.debit AS REAL) - CAST(a.credit AS REAL) AS TEXT) as balance, COALESCE((SELECT code FROM currencies WHERE is_base = 1 LIMIT 1), '') as currency,
            'تلقائي من دليل الحسابات' as notes, a.is_active, a.created_at, a.updated_at
         FROM accounts a
         WHERE a.id = ? AND a.code LIKE '123%' AND a.category = 'Detail'
         AND NOT EXISTS (SELECT 1 FROM customers WHERE id = a.id OR account_id = a.id)"
    )
    .bind(id.to_string())
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_customer).transpose()
}

pub async fn find_by_account_id(pool: &SqlitePool, account_id: &AccountId) -> Result<Option<Customer>, AppError> {
    let row = sqlx::query_as::<_, CustomerRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
         FROM customers WHERE account_id = ?
         UNION ALL
         SELECT 
            a.id, 
            CASE WHEN a.code LIKE '123%' THEN SUBSTR(a.code, 4) ELSE a.code END as code,
            a.name_ar as name, '' as phone, '' as address, a.id as account_id,
            a.debit as debit, a.credit as credit,             a.opening_balance, CAST(CAST(a.debit AS REAL) - CAST(a.credit AS REAL) AS TEXT) as balance, COALESCE((SELECT code FROM currencies WHERE is_base = 1 LIMIT 1), '') as currency,
            'تلقائي من دليل الحسابات' as notes, a.is_active, a.created_at, a.updated_at
         FROM accounts a
         WHERE a.id = ? AND a.code LIKE '123%' AND a.category = 'Detail'
         AND NOT EXISTS (SELECT 1 FROM customers WHERE account_id = a.id OR id = a.id)"
    )
    .bind(account_id.0.to_string())
    .bind(account_id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_customer).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Customer>, AppError> {
    let rows = sqlx::query_as::<_, CustomerRow>(
        "SELECT id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at 
         FROM customers
         UNION ALL
         SELECT 
            a.id, 
            CASE WHEN a.code LIKE '123%' THEN SUBSTR(a.code, 4) ELSE a.code END as code,
            a.name_ar as name, '' as phone, '' as address, a.id as account_id,
            a.debit as debit, a.credit as credit,             a.opening_balance, CAST(CAST(a.debit AS REAL) - CAST(a.credit AS REAL) AS TEXT) as balance, COALESCE((SELECT code FROM currencies WHERE is_base = 1 LIMIT 1), '') as currency,
            'تلقائي من دليل الحسابات' as notes, a.is_active, a.created_at, a.updated_at
         FROM accounts a
         WHERE a.code LIKE '123%' AND a.category = 'Detail'
         AND NOT EXISTS (SELECT 1 FROM customers WHERE account_id = a.id OR id = a.id)
         ORDER BY name"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_customer).collect()
}

pub async fn get_next_customer_number(pool: &SqlitePool) -> Result<i32, AppError> {
    let next_num: i32 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(MIN(candidate), 1)
        FROM (
            SELECT 1 as candidate
            UNION ALL
            SELECT CAST(code AS INTEGER) + 1 as candidate FROM customers WHERE code GLOB '[0-9]*'
            UNION ALL
            SELECT CAST(SUBSTR(code, 4) AS INTEGER) + 1 as candidate FROM accounts WHERE code LIKE '123%' AND code GLOB '123[0-9]*' AND code != '1230'
        )
        WHERE candidate NOT IN (
            SELECT CAST(code AS INTEGER) FROM customers WHERE code GLOB '[0-9]*'
            UNION
            SELECT CAST(SUBSTR(code, 4) AS INTEGER) FROM accounts WHERE code LIKE '123%' AND code GLOB '123[0-9]*' AND code != '1230'
        )
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(next_num)
}
