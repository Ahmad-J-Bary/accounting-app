use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::StockAdjustment;
use domain::shared::ids::StockAdjustmentId;

pub async fn save(pool: &SqlitePool, adj: &StockAdjustment) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO stock_adjustments (id, material_id, system_quantity, actual_quantity, difference, reason, unit_cost, notes, reference, adjustment_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            material_id = excluded.material_id,
            system_quantity = excluded.system_quantity,
            actual_quantity = excluded.actual_quantity,
            difference = excluded.difference,
            reason = excluded.reason,
            unit_cost = excluded.unit_cost,
            notes = excluded.notes,
            reference = excluded.reference,
            adjustment_date = excluded.adjustment_date"
    )
    .bind(adj.id.to_string())
    .bind(adj.material_id.to_string())
    .bind(adj.system_quantity.to_string())
    .bind(adj.actual_quantity.to_string())
    .bind(adj.difference.to_string())
    .bind(&adj.reason)
    .bind(adj.unit_cost.to_string())
    .bind(&adj.notes)
    .bind(&adj.reference)
    .bind(adj.adjustment_date.to_rfc3339())
    .bind(adj.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &StockAdjustmentId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM stock_adjustments WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
