use sqlx::SqlitePool;
use application::errors::AppError;
use domain::assets::{FixedAsset, AssetCategory, AssetMovement, DepreciationSchedule};

pub async fn save_asset(pool: &SqlitePool, asset: &FixedAsset) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO fixed_assets (id, code, name, category_id, warehouse_id, purchase_date, purchase_cost, currency, fx_rate, useful_life_months, salvage_value, accumulated_depreciation, status, location, notes, asset_account_id, depreciation_account_id, accumulated_depreciation_account_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(asset.id.0.to_string())
    .bind(&asset.code)
    .bind(&asset.name)
    .bind(asset.category_id.to_string())
    .bind(asset.warehouse_id.map(|id| id.to_string()))
    .bind(asset.purchase_date.to_rfc3339())
    .bind(asset.purchase_cost.amount().to_string())
    .bind(asset.purchase_cost.currency().code.clone())
    .bind(asset.fx_rate.to_string())
    .bind(asset.useful_life_months as i64)
    .bind(asset.salvage_value.as_ref().map(|m| m.amount().to_string()))
    .bind(asset.accumulated_depreciation.amount().to_string())
    .bind(format!("{:?}", asset.status))
    .bind(&asset.location)
    .bind(&asset.notes)
    .bind(asset.asset_account_id.to_string())
    .bind(asset.depreciation_account_id.to_string())
    .bind(asset.accumulated_depreciation_account_id.to_string())
    .bind(asset.created_at.to_rfc3339())
    .bind(asset.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save_category(pool: &SqlitePool, category: &AssetCategory) -> Result<(), AppError> {
    sqlx::query("INSERT OR REPLACE INTO asset_categories (id, name, asset_type) VALUES (?, ?, ?)")
        .bind(category.id.to_string())
        .bind(&category.name)
        .bind(format!("{:?}", category.asset_type))
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save_movement(pool: &SqlitePool, movement: &AssetMovement) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO asset_movements (id, asset_id, movement_type, movement_date, quantity, amount, currency, description, reference_no, journal_entry_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(movement.id.to_string())
    .bind(movement.asset_id.to_string())
    .bind(format!("{:?}", movement.movement_type))
    .bind(movement.date.to_rfc3339())
    .bind(movement.quantity.map(|q| q.to_string()))
    .bind(movement.amount.amount().to_string())
    .bind(movement.amount.currency().code.clone())
    .bind(&movement.description)
    .bind(&movement.reference_no)
    .bind(movement.journal_entry_id.map(|id| id.to_string()))
    .bind(movement.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn save_depreciation_schedule(pool: &SqlitePool, schedule: &DepreciationSchedule) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO depreciation_schedules (id, fixed_asset_id, period_date, depreciation_amount, accumulated_depreciation, remaining_value, currency, status, journal_entry_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(schedule.id.to_string())
    .bind(schedule.fixed_asset_id.to_string())
    .bind(schedule.period_date.to_rfc3339())
    .bind(schedule.depreciation_amount.amount().to_string())
    .bind(schedule.accumulated_depreciation.amount().to_string())
    .bind(schedule.remaining_value.amount().to_string())
    .bind(schedule.depreciation_amount.currency().code.clone())
    .bind(format!("{:?}", schedule.status))
    .bind(schedule.journal_entry_id.map(|id| id.to_string()))
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
