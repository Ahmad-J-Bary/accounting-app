use super::mappers::row_to_adjustment;
use super::models::AdjustmentRow;
use application::errors::AppError;
use domain::inventory::StockAdjustment;
use domain::shared::ids::StockAdjustmentId;
use sqlx::SqlitePool;

const COLUMNS: &str = "id, material_id, system_quantity, actual_quantity, difference, reason, unit_cost, notes, reference, adjustment_date, created_at";

pub async fn find_by_id(
    pool: &SqlitePool,
    id: &StockAdjustmentId,
) -> Result<Option<StockAdjustment>, AppError> {
    let row = sqlx::query_as::<_, AdjustmentRow>(&format!(
        "SELECT {} FROM stock_adjustments WHERE id = ?",
        COLUMNS
    ))
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

pub async fn get_next_reference(pool: &SqlitePool) -> Result<String, AppError> {
    let row: Option<(Option<i64>,)> = sqlx::query_as(
        "SELECT COALESCE(MAX(CAST(reference AS INTEGER)), 0) + 1 FROM stock_adjustments WHERE reference GLOB '[0-9]*'"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    let max_val = row.and_then(|r| r.0).unwrap_or(1);
    Ok(max_val.to_string())
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<StockAdjustment>, AppError> {
    let rows = sqlx::query_as::<_, AdjustmentRow>(&format!(
        "SELECT {} FROM stock_adjustments ORDER BY adjustment_date DESC",
        COLUMNS
    ))
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_adjustment).collect()
}
