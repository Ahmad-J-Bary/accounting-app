use application::errors::AppError;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{PaymentId, CustomerId, SupplierId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::PaymentRow;

pub fn row_to_payment(row: PaymentRow) -> Result<Payment, AppError> {
    let payment_type = match row.payment_type.as_str() {
        "Receipt" => PaymentType::Receipt,
        "SupplierPayment" => PaymentType::SupplierPayment,
        "CashIn" => PaymentType::CashIn,
        "CashOut" => PaymentType::CashOut,
        _ => PaymentType::Other,
    };
    Ok(Payment {
        id: PaymentId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        payment_type,
        amount: Decimal::from_str(&row.amount).unwrap_or(Decimal::ZERO),
        payment_date: DateTime::parse_from_rfc3339(&row.payment_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        customer_id: row.customer_id.and_then(|id| id.parse::<CustomerId>().ok()),
        supplier_id: row.supplier_id.and_then(|id| id.parse::<SupplierId>().ok()),
        reference: row.reference,
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
