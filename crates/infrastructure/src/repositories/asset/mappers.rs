use application::errors::AppError;
use domain::assets::{FixedAsset, FixedAssetId, AssetCategory, AssetType, AssetMovement, AssetMovementType, AssetStatus, DepreciationSchedule, DepreciationStatus};
use domain::shared::{Money, Currency};
use rust_decimal::Decimal;
use std::str::FromStr;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::{AssetRow, AssetCategoryRow, AssetMovementRow, DepreciationScheduleRow};

fn currency_from_code(code: &str) -> Currency {
    Currency::new(code, code, code, "", 2, false)
}

pub fn row_to_asset(row: AssetRow) -> Result<FixedAsset, AppError> {
    Ok(FixedAsset {
        id: FixedAssetId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        code: row.code,
        name: row.name,
        category_id: Uuid::parse_str(&row.category_id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        purchase_date: DateTime::parse_from_rfc3339(&row.purchase_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        purchase_cost: Money::new(Decimal::from_str(&row.purchase_cost).unwrap_or_default(), currency_from_code(&row.currency)),
        fx_rate: Decimal::from_str(&row.fx_rate).unwrap_or(Decimal::ONE),
        useful_life_months: row.useful_life_months as u32,
        salvage_value: row.salvage_value.and_then(|s| Decimal::from_str(&s).ok()).map(|d| Money::new(d, currency_from_code(&row.currency))),
        accumulated_depreciation: Money::new(Decimal::from_str(&row.accumulated_depreciation).unwrap_or_default(), currency_from_code(&row.currency)),
        status: match row.status.as_str() {
            "Disposed" => AssetStatus::Disposed,
            "Sold" => AssetStatus::Sold,
            "Damaged" => AssetStatus::Damaged,
            _ => AssetStatus::Active,
        },
        location: Some(row.location),
        notes: row.notes,
        asset_account_id: Uuid::parse_str(&row.asset_account_id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        depreciation_account_id: Uuid::parse_str(&row.depreciation_account_id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        accumulated_depreciation_account_id: Uuid::parse_str(&row.accumulated_depreciation_account_id).map_err(|e| AppError::Infrastructure(e.to_string()))?,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        updated_at: DateTime::parse_from_rfc3339(&row.updated_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}

pub fn row_to_category(row: AssetCategoryRow) -> AssetCategory {
    AssetCategory {
        id: Uuid::parse_str(&row.id).unwrap_or_else(|_| Uuid::new_v4()),
        name: row.name,
        asset_type: match row.asset_type.as_str() {
            "Fixed" => AssetType::Fixed,
            _ => AssetType::Consumable,
        },
    }
}

pub fn row_to_movement(row: AssetMovementRow) -> AssetMovement {
    AssetMovement {
        id: Uuid::parse_str(&row.id).unwrap_or_else(|_| Uuid::new_v4()),
        asset_id: Uuid::parse_str(&row.asset_id).unwrap_or_else(|_| Uuid::new_v4()),
        movement_type: match row.movement_type.as_str() {
            "Acquisition" => AssetMovementType::Acquisition,
            "Depreciation" => AssetMovementType::Depreciation,
            "Disposal" => AssetMovementType::Disposal,
            "Sale" => AssetMovementType::Sale,
            "Adjustment" => AssetMovementType::Adjustment,
            "Transfer" => AssetMovementType::Transfer,
            "Issue" => AssetMovementType::Issue,
            "Consumption" => AssetMovementType::Consumption,
            "Damage" => AssetMovementType::Damage,
            _ => AssetMovementType::Revaluation,
        },
        date: DateTime::parse_from_rfc3339(&row.movement_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        quantity: row.quantity.and_then(|s| Decimal::from_str(&s).ok()),
        amount: Money::new(Decimal::from_str(&row.amount).unwrap_or_default(), row.currency.as_deref().map(currency_from_code).unwrap_or_else(|| currency_from_code(""))),
        description: row.description.unwrap_or_default(),
        reference_no: Some(row.reference_no.unwrap_or_default()),
        journal_entry_id: row.journal_entry_id.and_then(|s| Uuid::parse_str(&s).ok()),
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    }
}

pub fn row_to_schedule(row: DepreciationScheduleRow) -> DepreciationSchedule {
    DepreciationSchedule {
        id: Uuid::parse_str(&row.id).unwrap_or_else(|_| Uuid::new_v4()),
        fixed_asset_id: Uuid::parse_str(&row.fixed_asset_id).unwrap_or_else(|_| Uuid::new_v4()),
        period_date: DateTime::parse_from_rfc3339(&row.period_date).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
        depreciation_amount: Money::new(Decimal::from_str(&row.depreciation_amount).unwrap_or_default(), row.currency.as_deref().map(currency_from_code).unwrap_or_else(|| currency_from_code(""))),
        accumulated_depreciation: Money::new(Decimal::from_str(&row.accumulated_depreciation).unwrap_or_default(), row.currency.as_deref().map(currency_from_code).unwrap_or_else(|| currency_from_code(""))),
        remaining_value: Money::new(Decimal::from_str(&row.remaining_value).unwrap_or_default(), row.currency.as_deref().map(currency_from_code).unwrap_or_else(|| currency_from_code(""))),
        status: match row.status.as_str() {
            "Posted" => DepreciationStatus::Posted,
            _ => DepreciationStatus::Pending,
        },
        journal_entry_id: row.journal_entry_id.and_then(|s| Uuid::parse_str(&s).ok()),
    }
}
