use sqlx::SqlitePool;
use application::errors::AppError;
use domain::customers::Customer;
use domain::shared::CustomerId;

pub async fn save(pool: &SqlitePool, customer: &Customer) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO customers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            code = excluded.code,
            name = excluded.name,
            phone = excluded.phone,
            address = excluded.address,
            account_id = excluded.account_id,
            debit = excluded.debit,
            credit = excluded.credit,
            opening_balance = excluded.opening_balance,
            balance = excluded.balance,
            currency = excluded.currency,
            notes = excluded.notes,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at"
    )
    .bind(customer.id.to_string())
    .bind(&customer.code)
    .bind(&customer.name)
    .bind(customer.phone.as_ref().map(|s| s.as_str()).unwrap_or(""))
    .bind(customer.address.as_ref().map(|s| s.as_str()).unwrap_or(""))
    .bind(customer.account_id.as_ref().map(|id| id.0.to_string()))
    .bind(customer.debit.to_string())
    .bind(customer.credit.to_string())
    .bind(customer.opening_balance.to_string())
    .bind(customer.balance.to_string())
    .bind(&customer.currency.code)
    .bind(&customer.notes)
    .bind(customer.is_active)
    .bind(customer.created_at.to_rfc3339())
    .bind(customer.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &CustomerId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM customers WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
