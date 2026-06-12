use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::StockAdjustment;
use domain::shared::ids::{StockAdjustmentId};
use super::models::AdjustmentRow;
use super::mappers::row_to_adjustment;

pub async fn find_by_id(pool: &SqlitePool, id: &StockAdjustmentId) -> Result<Option<StockAdjustment>, AppError> {
    let row = sqlx::query_as::<_, AdjustmentRow>(
        "SELECT id, material_id, system_quantity, actual_quantity, difference, reason, unit_cost, notes, adjustment_date, created_at
         FROM stock_adjustments WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    row.map(row_to_adjustment).transpose()
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<StockAdjustment>, AppError> {
    let rows = sqlx::query_as::<_, AdjustmentRow>(
        "SELECT id, material_id, system_quantity, actual_quantity, difference, reason, unit_cost, notes, adjustment_date, created_at
         FROM stock_adjustments ORDER BY adjustment_date DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_adjustment).collect()
}
