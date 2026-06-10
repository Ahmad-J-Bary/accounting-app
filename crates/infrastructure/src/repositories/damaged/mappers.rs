use application::errors::AppError;
use domain::inventory::DamagedItem;
use domain::shared::ids::{DamagedItemId, MaterialId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::DamagedItemRow;

pub fn row_to_damaged(row: DamagedItemRow) -> Result<DamagedItem, AppError> {
    Ok(DamagedItem {
        id: DamagedItemId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        material_id: MaterialId(Uuid::parse_str(&row.material_id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        quantity: Decimal::from_str(&row.quantity).unwrap_or(Decimal::ZERO),
        reason: row.reason,
        damage_date: DateTime::parse_from_rfc3339(&row.damage_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        cost_impact: Decimal::from_str(&row.cost_impact).unwrap_or(Decimal::ZERO),
        notes: row.notes,
        reference: row.reference,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
