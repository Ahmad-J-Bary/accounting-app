use sqlx::SqlitePool;
use application::errors::AppError;
use domain::payments::Payment;
use domain::shared::ids::PaymentId;

pub async fn save(pool: &SqlitePool, payment: &Payment) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO payments (id, payment_type, amount, payment_date, customer_id, supplier_id, reference, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(payment.id.to_string())
    .bind(format!("{:?}", payment.payment_type))
    .bind(payment.amount.to_string())
    .bind(payment.payment_date.to_rfc3339())
    .bind(payment.customer_id.as_ref().map(|c| c.to_string()))
    .bind(payment.supplier_id.as_ref().map(|s| s.to_string()))
    .bind(&payment.reference)
    .bind(&payment.notes)
    .bind(payment.created_at.to_rfc3339())
    .bind(payment.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &PaymentId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM payments WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
