use sqlx::SqlitePool;
use application::errors::AppError;
use domain::suppliers::Supplier;
use domain::shared::ids::SupplierId;

pub async fn save(pool: &SqlitePool, supplier: &Supplier) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO suppliers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at)
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
    .bind(supplier.id.to_string())
    .bind(&supplier.code)
    .bind(&supplier.name)
    .bind(supplier.phone.as_deref().unwrap_or(""))
    .bind(supplier.address.as_deref().unwrap_or(""))
    .bind(supplier.account_id.as_ref().map(|id| id.0.to_string()))
    .bind(supplier.debit.to_string())
    .bind(supplier.credit.to_string())
    .bind(supplier.opening_balance.to_string())
    .bind(supplier.balance.to_string())
    .bind(supplier.currency.code())
    .bind(&supplier.notes)
    .bind(supplier.is_active)
    .bind(supplier.created_at.to_rfc3339())
    .bind(supplier.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &SupplierId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM suppliers WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
