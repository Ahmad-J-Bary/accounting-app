use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::DamagedItem;
use domain::shared::ids::{DamagedItemId};
use super::models::DamagedItemRow;
use super::mappers::row_to_damaged;

pub async fn find_by_id(pool: &SqlitePool, id: &DamagedItemId) -> Result<Option<DamagedItem>, AppError> {
    let row = sqlx::query_as::<_, DamagedItemRow>(
        "SELECT id, material_id, quantity, reason, damage_date, cost_impact, notes, created_at
         FROM damaged_items WHERE id = ?"
    )
    .bind(id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    row.map(row_to_damaged).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<DamagedItem>, AppError> {
    let rows = sqlx::query_as::<_, DamagedItemRow>(
        "SELECT id, material_id, quantity, reason, damage_date, cost_impact, notes, created_at
         FROM damaged_items ORDER BY damage_date DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_damaged).collect()
}
