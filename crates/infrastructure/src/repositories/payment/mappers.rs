use super::models::PaymentRow;
use application::errors::AppError;
use chrono::{DateTime, Utc};
use domain::payments::{Payment, PaymentType};
use domain::shared::ids::{AccountId, CustomerId, PaymentId, SupplierId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

pub fn row_to_payment(row: PaymentRow) -> Result<Payment, AppError> {
    let payment_type = match row.payment_type.as_str() {
        "Receipt" => PaymentType::Receipt,
        "SupplierPayment" => PaymentType::SupplierPayment,
        "CustomerPayment" => PaymentType::CustomerPayment,
        "SupplierReceipt" => PaymentType::SupplierReceipt,
        "ExpenseVoucher" => PaymentType::ExpenseVoucher,
        "DrawingsVoucher" => PaymentType::DrawingsVoucher,
        "CashIn" => PaymentType::CashIn,
        "CashOut" => PaymentType::CashOut,
        _ => PaymentType::Other,
    };
    Ok(Payment {
        id: PaymentId(
            Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        ),
        voucher_number: row.voucher_number.unwrap_or_else(|| row.id.clone()),
        payment_type,
        amount: Decimal::from_str(&row.amount).unwrap_or(Decimal::ZERO),
        currency_code: row.currency_code.unwrap_or_default(),
        exchange_rate: row
            .exchange_rate
            .and_then(|s| Decimal::from_str(&s).ok())
            .unwrap_or(Decimal::ONE),
        payment_date: DateTime::parse_from_rfc3339(&row.payment_date)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        debit_account_id: row
            .debit_account_id
            .and_then(|id| id.parse::<AccountId>().ok()),
        credit_account_id: row
            .credit_account_id
            .and_then(|id| id.parse::<AccountId>().ok()),
        journal_entry_number: row.journal_entry_number,
        customer_id: row.customer_id.and_then(|id| id.parse::<CustomerId>().ok()),
        supplier_id: row.supplier_id.and_then(|id| id.parse::<SupplierId>().ok()),
        reference: row.reference,
        notes: row.notes,
        invoice_id: row.invoice_id,
        created_at: DateTime::parse_from_rfc3339(&row.created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}
