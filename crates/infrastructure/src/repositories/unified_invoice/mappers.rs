use application::errors::AppError;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType, InvoiceStatus, PaymentMethod};
use domain::sales::invoice_line::InvoiceLine;
use domain::shared::ids::{InvoiceId, CustomerId, SupplierId};
use domain::shared::currency::Currency;
use domain::shared::money::Money;
use domain::shared::monetary_amount::MonetaryAmount;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use super::models::{InvoiceRow};

pub fn row_to_invoice(row: InvoiceRow, lines: Vec<InvoiceLine>) -> Result<UnifiedInvoice, AppError> {
    let invoice_type = match row.invoice_type.as_str() {
        "Sales" => InvoiceType::Sales,
        "Purchase" => InvoiceType::Purchase,
        "OpeningBalance" => InvoiceType::OpeningBalance,
        _ => InvoiceType::Sales,
    };

    let status = match row.status.as_str() {
        "Draft" => InvoiceStatus::Draft,
        "Posted" => InvoiceStatus::Posted,
        "Cancelled" => InvoiceStatus::Cancelled,
        "Reversed" => InvoiceStatus::Reversed,
        _ => InvoiceStatus::Draft,
    };

    let payment_method = match row.payment_method.as_str() {
        "Cash" => PaymentMethod::Cash,
        "Deferred" => PaymentMethod::Deferred,
        "Partial" => PaymentMethod::Partial,
        _ => PaymentMethod::Deferred,
    };

    Ok(UnifiedInvoice {
        id: InvoiceId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        invoice_number: row.invoice_number,
        invoice_type,
        customer_id: row.customer_id.and_then(|id| id.parse::<CustomerId>().ok()),
        customer_name: row.customer_name,
        supplier_id: row.supplier_id.and_then(|id| id.parse::<SupplierId>().ok()),
        supplier_name: row.supplier_name,
        lines,
        tax_amount: MonetaryAmount {
            original: Money::new(Decimal::from_str(&row.tax_amount).unwrap_or(Decimal::ZERO), Currency::new(&row.currency_code, &row.currency_code, &row.currency_code, "", 2, false)),
            base_amount: Decimal::from_str(&row.tax_amount_base).unwrap_or(Decimal::ZERO),
            fx_rate: Decimal::from_str(&row.exchange_rate).unwrap_or(Decimal::ONE),
        },
        discount_amount: MonetaryAmount {
            original: Money::new(Decimal::from_str(&row.discount_amount).unwrap_or(Decimal::ZERO), Currency::new(&row.currency_code, &row.currency_code, &row.currency_code, "", 2, false)),
            base_amount: Decimal::from_str(&row.discount_amount_base).unwrap_or(Decimal::ZERO),
            fx_rate: Decimal::from_str(&row.exchange_rate).unwrap_or(Decimal::ONE),
        },
        extra_costs: MonetaryAmount {
            original: Money::new(Decimal::from_str(&row.extra_costs).unwrap_or(Decimal::ZERO), Currency::new(&row.currency_code, &row.currency_code, &row.currency_code, "", 2, false)),
            base_amount: Decimal::from_str(&row.extra_costs_base).unwrap_or(Decimal::ZERO),
            fx_rate: Decimal::from_str(&row.exchange_rate).unwrap_or(Decimal::ONE),
        },
        total_amount: MonetaryAmount {
            original: Money::new(Decimal::from_str(&row.total_amount).unwrap_or(Decimal::ZERO), Currency::new(&row.currency_code, &row.currency_code, &row.currency_code, "", 2, false)),
            base_amount: Decimal::from_str(&row.total_amount_base).unwrap_or(Decimal::ZERO),
            fx_rate: Decimal::from_str(&row.exchange_rate).unwrap_or(Decimal::ONE),
        },
        payment_method,
        amount_paid: MonetaryAmount {
            original: Money::new(Decimal::from_str(&row.amount_paid).unwrap_or(Decimal::ZERO), Currency::new(&row.currency_code, &row.currency_code, &row.currency_code, "", 2, false)),
            base_amount: Decimal::from_str(&row.amount_paid_base).unwrap_or(Decimal::ZERO),
            fx_rate: Decimal::from_str(&row.exchange_rate).unwrap_or(Decimal::ONE),
        },
        status,
        issued_at: DateTime::parse_from_rfc3339(&row.issued_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        currency_code: row.currency_code,
        exchange_rate: Decimal::from_str(&row.exchange_rate).unwrap_or(Decimal::ONE),
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
