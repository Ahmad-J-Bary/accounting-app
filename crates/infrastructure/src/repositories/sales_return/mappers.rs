use std::str::FromStr;
use application::errors::AppError;
use domain::returns::SalesReturn;
use domain::returns::sales_return::SalesReturnLine;
use domain::shared::ids::{SalesReturnId, CustomerId, MaterialId};
use rust_decimal::Decimal;
use chrono::{DateTime, Utc};
use super::models::{SalesReturnRow, SalesReturnLineRow};

pub fn row_to_sales_return(row: SalesReturnRow, lines: Vec<SalesReturnLineRow>) -> Result<SalesReturn, AppError> {
    let id = SalesReturnId::from_str(&row.id).map_err(|_| AppError::Invalid("معرف غير صالح".into()))?;
    let customer_id = CustomerId::from_str(&row.customer_id).map_err(|_| AppError::Invalid("معرف عميل غير صالح".into()))?;

    let parse_decimal = |s: &str| Decimal::from_str(s).unwrap_or(Decimal::ZERO);
    let parse_date = |s: &str| DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(SalesReturn {
        id,
        return_number: row.return_number,
        customer_id,
        return_date: parse_date(&row.return_date),
        lines: lines.into_iter().map(|l| {
            let mid = MaterialId::from_str(&l.material_id).unwrap_or_default();
            SalesReturnLine {
                id: uuid::Uuid::from_str(&l.id).unwrap_or_default(),
                material_id: mid,
                quantity: parse_decimal(&l.quantity),
                unit_price: parse_decimal(&l.unit_price),
                unit_id: l.unit_id,
                line_total: parse_decimal(&l.line_total),
                notes: l.notes,
                invoice_line_id: l.invoice_line_id,
            }
        }).collect(),
        total_amount: parse_decimal(&row.total_amount),
        notes: row.notes,
        created_at: parse_date(&row.created_at),
        updated_at: parse_date(&row.updated_at),
    })
}
