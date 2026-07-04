use application::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::InventoryLotRow;
use domain::inventory::inventory_lot::InventoryLot;

fn parse_optional_decimal(s: Option<String>) -> Result<Option<Decimal>, AppError> {
    match s {
        Some(v) if !v.is_empty() => Ok(Some(Decimal::from_str(&v).map_err(|e| AppError::Infrastructure(e.to_string()))?)),
        _ => Ok(None),
    }
}

pub fn row_to_inventory_lot(row: InventoryLotRow) -> Result<InventoryLot, AppError> {
    Ok(InventoryLot {
        id: Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        material_id: Uuid::parse_str(&row.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        purchase_invoice_id: row.purchase_invoice_id
            .map(|s| Uuid::parse_str(&s).map_err(|e| AppError::Infrastructure(e.to_string())))
            .transpose()?,
        movement_id: Uuid::parse_str(&row.movement_id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        quantity_original: Decimal::from_str(&row.quantity_original).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        quantity_remaining: Decimal::from_str(&row.quantity_remaining).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        unit_cost_base: Decimal::from_str(&row.unit_cost_base).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        raw_unit_cost_base: Decimal::from_str(&row.raw_unit_cost_base).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        currency_code: row.currency_code,
        fx_rate: Decimal::from_str(&row.fx_rate).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        purchase_date: DateTime::parse_from_rfc3339(&row.purchase_date)
            .map_err(|e| AppError::Infrastructure(e.to_string()))?
            .with_timezone(&Utc),
        created_at: DateTime::parse_from_rfc3339(&row.created_at)
            .map_err(|e| AppError::Infrastructure(e.to_string()))?
            .with_timezone(&Utc),
        retail_price_base: parse_optional_decimal(row.retail_price_base)?,
        semi_wholesale_price_base: parse_optional_decimal(row.semi_wholesale_price_base)?,
        wholesale_price_base: parse_optional_decimal(row.wholesale_price_base)?,
    })
}
