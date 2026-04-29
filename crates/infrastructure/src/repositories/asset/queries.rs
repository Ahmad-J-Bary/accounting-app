use sqlx::SqlitePool;
use application::errors::AppError;
use domain::assets::{FixedAsset, FixedAssetId, AssetCategory, AssetType, AssetMovement, DepreciationSchedule};
use uuid::Uuid;
use super::models::{AssetRow, AssetCategoryRow, AssetMovementRow, DepreciationScheduleRow};
use super::mappers::{row_to_asset, row_to_category, row_to_movement, row_to_schedule};

pub async fn find_asset_by_id(pool: &SqlitePool, id: &FixedAssetId) -> Result<Option<FixedAsset>, AppError> {
    let row = sqlx::query_as::<_, AssetRow>("SELECT * FROM fixed_assets WHERE id = ?")
        .bind(id.0.to_string())
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    row.map(row_to_asset).transpose()
}

pub async fn list_assets(pool: &SqlitePool) -> Result<Vec<FixedAsset>, AppError> {
    let rows = sqlx::query_as::<_, AssetRow>("SELECT * FROM fixed_assets ORDER BY code ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_asset).collect()
}

pub async fn list_categories(pool: &SqlitePool, asset_type: AssetType) -> Result<Vec<AssetCategory>, AppError> {
    let rows = sqlx::query_as::<_, AssetCategoryRow>("SELECT * FROM asset_categories WHERE asset_type = ?")
        .bind(format!("{:?}", asset_type))
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows.into_iter().map(row_to_category).collect())
}

pub async fn list_movements_by_asset(pool: &SqlitePool, asset_id: &Uuid) -> Result<Vec<AssetMovement>, AppError> {
    let rows = sqlx::query_as::<_, AssetMovementRow>("SELECT * FROM asset_movements WHERE asset_id = ? ORDER BY movement_date DESC")
        .bind(asset_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows.into_iter().map(row_to_movement).collect())
}

pub async fn list_all_movements(pool: &SqlitePool) -> Result<Vec<AssetMovement>, AppError> {
    let rows = sqlx::query_as::<_, AssetMovementRow>("SELECT * FROM asset_movements ORDER BY movement_date DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows.into_iter().map(row_to_movement).collect())
}

pub async fn get_depreciation_schedule(pool: &SqlitePool, asset_id: &Uuid) -> Result<Vec<DepreciationSchedule>, AppError> {
    let rows = sqlx::query_as::<_, DepreciationScheduleRow>("SELECT * FROM depreciation_schedules WHERE fixed_asset_id = ? ORDER BY period_date ASC")
        .bind(asset_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows.into_iter().map(row_to_schedule).collect())
}
