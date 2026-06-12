use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::StockAdjustment;
use domain::shared::ids::{StockAdjustmentId};
use super::models::AdjustmentRow;
use super::mappers::row_to_adjustment;

const COLUMNS: &str = "id, material_id, system_quantity, actual_quantity, difference, reason, unit_cost, notes, reference, adjustment_date, created_at";

pub async fn find_by_id(pool: &SqlitePool, id: &StockAdjustmentId) -> Result<Option<StockAdjustment>, AppError> {
    let row = sqlx::query_as::<_, AdjustmentRow>(
        &format!("SELECT {} FROM stock_adjustments WHERE id = ?", COLUMNS)
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    row.map(row_to_adjustment).transpose()
}

pub async fn count(pool: &SqlitePool) -> Result<i64, AppError> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM stock_adjustments")
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<StockAdjustment>, AppError> {
    let rows = sqlx::query_as::<_, AdjustmentRow>(
        &format!("SELECT {} FROM stock_adjustments ORDER BY adjustment_date DESC", COLUMNS)
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_adjustment).collect()
}
