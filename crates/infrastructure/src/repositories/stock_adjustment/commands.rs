use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::StockAdjustment;

pub async fn save(pool: &SqlitePool, adj: &StockAdjustment) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO stock_adjustments (id, material_id, system_quantity, actual_quantity, difference, reason, adjustment_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(adj.id.to_string())
    .bind(adj.material_id.to_string())
    .bind(adj.system_quantity.to_string())
    .bind(adj.actual_quantity.to_string())
    .bind(adj.difference.to_string())
    .bind(&adj.reason)
    .bind(adj.adjustment_date.to_rfc3339())
    .bind(adj.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
