use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::stock_movement::{StockMovement};

/// Resolves the warehouse ID to use for a stock movement.
/// If the movement already has a warehouse_id, it's returned as-is.
/// Otherwise, the default warehouse ID is looked up and used.
async fn resolve_warehouse_id(pool: &SqlitePool, movement: &StockMovement) -> Result<Option<String>, AppError> {
    if let Some(id) = &movement.warehouse_id {
        return Ok(Some(id.to_string()));
    }
    sqlx::query_scalar::<_, String>("SELECT id FROM warehouses WHERE is_default = 1 LIMIT 1")
        .fetch_optional(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))
}

pub async fn save(pool: &SqlitePool, movement: &StockMovement) -> Result<(), AppError> {
    let warehouse_id = resolve_warehouse_id(pool, movement).await?;

    sqlx::query(
        "INSERT INTO stock_movements (id, material_id, quantity, unit_cost, unit_cost_base, total_cost, total_cost_base, raw_total_cost_base, original_currency, fx_rate, movement_type, reason, reference, warehouse_id, movement_date, created_at, signed_quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(movement.id.to_string())
    .bind(movement.material_id.to_string())
    .bind(movement.quantity.to_string())
    .bind(movement.unit_cost.to_string())
    .bind(movement.unit_cost_base.to_string())
    .bind(movement.total_cost.to_string())
    .bind(movement.total_cost_base.to_string())
    .bind(movement.raw_total_cost_base.to_string())
    .bind(&movement.original_currency)
    .bind(movement.fx_rate.to_string())
    .bind(format!("{:?}", movement.movement_type))
    .bind(&movement.notes)
    .bind(&movement.reference)
    .bind(warehouse_id)
    .bind(movement.movement_date.to_rfc3339())
    .bind(movement.created_at.to_rfc3339())
    .bind(movement.signed_quantity.map(|v| v.to_string()))
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn delete_by_reference(pool: &SqlitePool, reference: &str, movement_type: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM stock_movements WHERE reference = ? AND movement_type = ?")
        .bind(reference)
        .bind(movement_type)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}
