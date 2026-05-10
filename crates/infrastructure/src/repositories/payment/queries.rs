use sqlx::SqlitePool;
use application::errors::AppError;
use domain::payments::Payment;
use domain::shared::ids::{PaymentId, CustomerId, SupplierId};
use super::models::PaymentRow;
use super::mappers::row_to_payment;

const SELECT_COLS: &str = "SELECT id, voucher_number, payment_type, amount, currency_code, exchange_rate, payment_date, debit_account_id, credit_account_id, journal_entry_number, customer_id, supplier_id, reference, notes, created_at, updated_at FROM payments";

pub async fn find_by_id(pool: &SqlitePool, id: &PaymentId) -> Result<Option<Payment>, AppError> {
    let row = sqlx::query_as::<_, PaymentRow>(&format!("{} WHERE id = ?", SELECT_COLS))
        .bind(id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    row.map(row_to_payment).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<Payment>, AppError> {
    let rows = sqlx::query_as::<_, PaymentRow>(&format!("{} ORDER BY payment_date DESC", SELECT_COLS))
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_payment).collect()
}

pub async fn list_by_customer(pool: &SqlitePool, customer_id: &CustomerId) -> Result<Vec<Payment>, AppError> {
    let rows = sqlx::query_as::<_, PaymentRow>(&format!("{} WHERE customer_id = ? ORDER BY payment_date DESC", SELECT_COLS))
        .bind(customer_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_payment).collect()
}

pub async fn list_by_supplier(pool: &SqlitePool, supplier_id: &SupplierId) -> Result<Vec<Payment>, AppError> {
    let rows = sqlx::query_as::<_, PaymentRow>(&format!("{} WHERE supplier_id = ? ORDER BY payment_date DESC", SELECT_COLS))
        .bind(supplier_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_payment).collect()
}
