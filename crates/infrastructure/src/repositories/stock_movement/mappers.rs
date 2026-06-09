use application::errors::AppError;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{MaterialId, WarehouseId};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::StockMovementRow;

pub fn row_to_movement(row: StockMovementRow) -> Result<StockMovement, AppError> {
    let m_type = match row.movement_type.as_str() {
        "In" | "MovementType::In" => MovementType::In,
        "Out" | "MovementType::Out" => MovementType::Out,
        "Transfer" | "MovementType::Transfer" => MovementType::Transfer,
        "Adjustment" | "MovementType::Adjustment" => MovementType::Adjustment,
        "OpeningBalance" | "MovementType::OpeningBalance" => MovementType::OpeningBalance,
        "Damaged" | "MovementType::Damaged" => MovementType::Damaged,
        "Sale" | "MovementType::Sale" => MovementType::Sale,
        "Purchase" | "MovementType::Purchase" => MovementType::Purchase,
        "SalesReturn" | "MovementType::SalesReturn" => MovementType::SalesReturn,
        "PurchaseReturn" | "MovementType::PurchaseReturn" => MovementType::PurchaseReturn,
        _ => MovementType::Adjustment,
    };

    Ok(StockMovement {
        id: Uuid::parse_str(&row.id).map_err(|e| AppError::Invalid(e.to_string()))?,
        material_id: MaterialId(Uuid::parse_str(&row.material_id).map_err(|e| AppError::Invalid(e.to_string()))?),
        movement_type: m_type,
        quantity: Decimal::from_str(&row.quantity).map_err(|e| AppError::Invalid(e.to_string()))?,
        unit_cost: Decimal::from_str(&row.unit_cost).unwrap_or(Decimal::ZERO),
        unit_cost_base: Decimal::from_str(&row.unit_cost_base).unwrap_or(Decimal::ZERO),
        total_cost: Decimal::from_str(&row.total_cost).unwrap_or(Decimal::ZERO),
        total_cost_base: Decimal::from_str(&row.total_cost_base).unwrap_or(Decimal::ZERO),
        raw_total_cost_base: row.raw_total_cost_base.and_then(|v| Decimal::from_str(&v).ok()).unwrap_or(Decimal::ZERO),
        original_currency: row.original_currency,
        fx_rate: Decimal::from_str(&row.fx_rate).unwrap_or(Decimal::ONE),
        reference: row.reference.unwrap_or_default(),
        notes: row.reason.unwrap_or_default(),
        movement_date: DateTime::parse_from_rfc3339(&row.movement_date).map_err(|e| AppError::Invalid(e.to_string()))?.with_timezone(&Utc),
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map_err(|e| AppError::Invalid(e.to_string()))?.with_timezone(&Utc),
        warehouse_id: row.warehouse_id.and_then(|id| Uuid::parse_str(&id).ok()).map(WarehouseId),
    })
}
