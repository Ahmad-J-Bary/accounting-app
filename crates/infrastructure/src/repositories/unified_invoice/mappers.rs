use application::errors::AppError;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType, InvoiceStatus};
use domain::sales::invoice_line::InvoiceLine;
use domain::shared::ids::{InvoiceId, CustomerId, SupplierId};
use domain::shared::money::Money;
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

    Ok(UnifiedInvoice {
        id: InvoiceId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        invoice_number: row.invoice_number,
        invoice_type,
        customer_id: row.customer_id.and_then(|id| id.parse::<u64>().ok().map(CustomerId)),
        supplier_id: row.supplier_id.and_then(|id| id.parse::<u64>().ok().map(SupplierId)),
        lines,
        tax_amount: Money::syp(Decimal::from_str(&row.tax_amount).unwrap_or(Decimal::ZERO)),
        discount_amount: Money::syp(Decimal::from_str(&row.discount_amount).unwrap_or(Decimal::ZERO)),
        total_amount: Money::syp(Decimal::from_str(&row.total_amount).unwrap_or(Decimal::ZERO)),
        status,
        issued_at: DateTime::parse_from_rfc3339(&row.issued_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        notes: row.notes,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
