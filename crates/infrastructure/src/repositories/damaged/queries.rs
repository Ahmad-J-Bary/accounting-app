use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::DamagedItem;
use domain::shared::ids::{DamagedItemId};
use super::models::DamagedItemRow;
use super::mappers::row_to_damaged;

const COLUMNS: &str = "id, material_id, quantity, reason, damage_date, cost_impact, notes, reference, created_at";

pub async fn find_by_id(pool: &SqlitePool, id: &DamagedItemId) -> Result<Option<DamagedItem>, AppError> {
    let row = sqlx::query_as::<_, DamagedItemRow>(
        &format!("SELECT {} FROM damaged_items WHERE id = ?", COLUMNS)
    )
    .bind(id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    row.map(row_to_damaged).transpose()
}

pub async fn count(pool: &SqlitePool) -> Result<i64, AppError> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM damaged_items")
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<DamagedItem>, AppError> {
    let rows = sqlx::query_as::<_, DamagedItemRow>(
        &format!("SELECT {} FROM damaged_items ORDER BY damage_date DESC", COLUMNS)
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_damaged).collect()
}
