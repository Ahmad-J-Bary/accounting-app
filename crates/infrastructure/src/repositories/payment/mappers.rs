use application::errors::AppError;
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{PaymentId, CustomerId, SupplierId, AccountId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::PaymentRow;

pub fn row_to_payment(row: PaymentRow) -> Result<Payment, AppError> {
    let payment_type = match row.payment_type.as_str() {
        "Receipt" => PaymentType::Receipt,
        "SupplierPayment" => PaymentType::SupplierPayment,
        "ExpenseVoucher" => PaymentType::ExpenseVoucher,
        "DrawingsVoucher" => PaymentType::DrawingsVoucher,
        "CashIn" => PaymentType::CashIn,
        "CashOut" => PaymentType::CashOut,
        _ => PaymentType::Other,
    };
    Ok(Payment {
        id: PaymentId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        voucher_number: row.voucher_number.unwrap_or_else(|| row.id.clone()),
        payment_type,
        amount: Decimal::from_str(&row.amount).unwrap_or(Decimal::ZERO),
        currency_code: row.currency_code.unwrap_or_else(|| "SYP".to_string()),
        exchange_rate: row.exchange_rate
            .and_then(|s| Decimal::from_str(&s).ok())
            .unwrap_or(Decimal::ONE),
        payment_date: DateTime::parse_from_rfc3339(&row.payment_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        debit_account_id: row.debit_account_id.and_then(|id| id.parse::<AccountId>().ok()),
        credit_account_id: row.credit_account_id.and_then(|id| id.parse::<AccountId>().ok()),
        journal_entry_number: row.journal_entry_number,
        customer_id: row.customer_id.and_then(|id| id.parse::<CustomerId>().ok()),
        supplier_id: row.supplier_id.and_then(|id| id.parse::<SupplierId>().ok()),
        reference: row.reference,
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
