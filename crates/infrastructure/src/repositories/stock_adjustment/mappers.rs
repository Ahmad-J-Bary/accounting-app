use application::errors::AppError;
use domain::inventory::StockAdjustment;
use domain::shared::ids::{StockAdjustmentId, MaterialId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::AdjustmentRow;

pub fn row_to_adjustment(row: AdjustmentRow) -> Result<StockAdjustment, AppError> {
    Ok(StockAdjustment {
        id: StockAdjustmentId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        material_id: MaterialId(Uuid::parse_str(&row.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        system_quantity: Decimal::from_str(&row.system_quantity).unwrap_or(Decimal::ZERO),
        actual_quantity: Decimal::from_str(&row.actual_quantity).unwrap_or(Decimal::ZERO),
        difference: Decimal::from_str(&row.difference).unwrap_or(Decimal::ZERO),
        reason: row.reason,
        unit_cost: Decimal::from_str(&row.unit_cost).unwrap_or(Decimal::ZERO),
        notes: row.notes.clone(),
        reference: row.reference,
        adjustment_date: DateTime::parse_from_rfc3339(&row.adjustment_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
