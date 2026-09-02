use super::models::ConsumableRow;
use application::errors::AppError;
use chrono::{DateTime, Utc};
use domain::assets::{Consumable, ConsumableId, ConsumableStatus};
use domain::shared::{Currency, Money};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;

pub fn row_to_consumable(row: ConsumableRow) -> Result<Consumable, AppError> {
    Ok(Consumable {
        id: ConsumableId(
            Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        ),
        code: row.code,
        name: row.name,
        category_id: Uuid::parse_str(&row.category_id)
            .map_err(|e| AppError::Infrastructure(e.to_string()))?,
        quantity_on_hand: Decimal::from_str(&row.quantity_on_hand).unwrap_or_default(),
        unit_cost: Money::new(
            Decimal::from_str(&row.unit_cost).unwrap_or_default(),
            Currency::new(&row.currency, &row.currency, &row.currency, "", 2, false),
        ),
        fx_rate: Decimal::from_str(&row.fx_rate).unwrap_or(Decimal::ONE),
        status: match row.status.as_str() {
            "Exhausted" => ConsumableStatus::Exhausted,
            "Damaged" => ConsumableStatus::Damaged,
            _ => ConsumableStatus::InStock,
        },
        location: Some(row.location),
        notes: row.notes,
        asset_account_id: Uuid::parse_str(&row.asset_account_id)
            .map_err(|e| AppError::Infrastructure(e.to_string()))?,
        expense_account_id: Uuid::parse_str(&row.expense_account_id)
            .map_err(|e| AppError::Infrastructure(e.to_string()))?,
        created_at: DateTime::parse_from_rfc3339(&row.created_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at)
            .map(|d| d.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now()),
    })
}
