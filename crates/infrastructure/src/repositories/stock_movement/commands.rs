use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::stock_movement::{StockMovement};

pub async fn save(pool: &SqlitePool, movement: &StockMovement) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO stock_movements (id, material_id, quantity, unit_cost, unit_cost_base, total_cost, total_cost_base, original_currency, fx_rate, movement_type, reason, reference, movement_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(movement.id.to_string())
    .bind(movement.material_id.to_string())
    .bind(movement.quantity.to_string())
    .bind(movement.unit_cost.to_string())
    .bind(movement.unit_cost_base.to_string())
    .bind(movement.total_cost.to_string())
    .bind(movement.total_cost_base.to_string())
    .bind(&movement.original_currency)
    .bind(movement.fx_rate.to_string())
    .bind(format!("{:?}", movement.movement_type))
    .bind(&movement.notes)
    .bind(&movement.reference)
    .bind(movement.movement_date.to_rfc3339())
    .bind(movement.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn delete_by_reference(pool: &SqlitePool, reference: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM stock_movements WHERE reference = ?")
        .bind(reference)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
