use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::{DateTime, Utc};
use domain::sales::{Invoice, InvoiceLine};
use domain::shared::ids::{InvoiceId, CustomerId, MaterialId};
use domain::shared::currency::Currency;
use domain::shared::money::Money;
use domain::shared::MonetaryAmount;
use application::errors::AppError;
use super::models::{InvoiceRow, InvoiceItemRow};
use uuid::Uuid;

pub fn row_to_invoice(
    row: InvoiceRow,
    lines: Vec<InvoiceLine>,
    base_currency: &Currency,
) -> Result<Invoice, AppError> {
    Ok(Invoice {
        id: InvoiceId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        invoice_number: row.invoice_number,
        customer_id: row.customer_id.parse::<CustomerId>().unwrap_or_default(),
        lines,
        tax_amount: Money::new(Decimal::from_str(&row.tax_amount).unwrap_or(Decimal::ZERO), base_currency.clone()),
        discount_amount: Money::new(Decimal::from_str(&row.discount_amount).unwrap_or(Decimal::ZERO), base_currency.clone()),
        issued_at: DateTime::parse_from_rfc3339(&row.invoice_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        posted: row.status == "Posted",
    })
}

pub fn item_row_to_line(
    row: InvoiceItemRow,
    base_currency: &Currency,
) -> Result<InvoiceLine, AppError> {
    Ok(InvoiceLine::new(
        Some(row.id),
        MaterialId(Uuid::parse_str(&row.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        Decimal::from_str(&row.quantity).unwrap_or(Decimal::ZERO),
        MonetaryAmount::from_base(
            Decimal::from_str(&row.unit_price).unwrap_or(Decimal::ZERO),
            base_currency.clone()
        ),
        Decimal::ZERO, None, None, None, None, None, None, None, None, None, None, None, None, None
    ))
}
