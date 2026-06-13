use std::str::FromStr;
use application::errors::AppError;
use domain::returns::PurchaseReturn;
use domain::returns::purchase_return::PurchaseReturnLine;
use domain::shared::ids::{PurchaseReturnId, SupplierId, MaterialId};
use rust_decimal::Decimal;
use chrono::{DateTime, Utc};
use super::models::{PurchaseReturnRow, PurchaseReturnLineRow};

pub fn row_to_purchase_return(row: PurchaseReturnRow, lines: Vec<PurchaseReturnLineRow>) -> Result<PurchaseReturn, AppError> {
    let id = PurchaseReturnId::from_str(&row.id).map_err(|_| AppError::Invalid("معرف غير صالح".into()))?;
    let supplier_id = SupplierId::from_str(&row.supplier_id).map_err(|_| AppError::Invalid("معرف مورد غير صالح".into()))?;

    let parse_decimal = |s: &str| Decimal::from_str(s).unwrap_or(Decimal::ZERO);
    let parse_date = |s: &str| DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());

    Ok(PurchaseReturn {
        id,
        return_number: row.return_number,
        supplier_id,
        return_date: parse_date(&row.return_date),
        lines: lines.into_iter().map(|l| {
            let mid = MaterialId::from_str(&l.material_id).unwrap_or_default();
            PurchaseReturnLine {
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
