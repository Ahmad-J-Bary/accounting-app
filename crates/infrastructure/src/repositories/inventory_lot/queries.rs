use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::inventory_lot::InventoryLot;
use super::models::InventoryLotRow;
use super::mappers::row_to_inventory_lot;

pub async fn find_available_by_material(
    pool: &SqlitePool,
    material_id: &str,
) -> Result<Vec<InventoryLot>, AppError> {
    let rows = sqlx::query_as::<_, InventoryLotRow>(
        "SELECT id, material_id, purchase_invoice_id, movement_id, quantity_original, quantity_remaining, unit_cost_base, raw_unit_cost_base, currency_code, fx_rate, purchase_date, created_at 
         FROM inventory_lots 
         WHERE material_id = ? AND CAST(quantity_remaining AS REAL) > 0 
         ORDER BY purchase_date ASC, created_at ASC"
    )
    .bind(material_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_inventory_lot).collect()
}

pub async fn find_by_movement_id(
    pool: &SqlitePool,
    movement_id: &str,
) -> Result<Vec<InventoryLot>, AppError> {
    let rows = sqlx::query_as::<_, InventoryLotRow>(
        "SELECT id, material_id, purchase_invoice_id, movement_id, quantity_original, quantity_remaining, unit_cost_base, raw_unit_cost_base, currency_code, fx_rate, purchase_date, created_at 
         FROM inventory_lots 
         WHERE movement_id = ?
         ORDER BY purchase_date ASC"
    )
    .bind(movement_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_inventory_lot).collect()
}

pub async fn find_by_purchase_invoice(
    pool: &SqlitePool,
    invoice_id: &str,
) -> Result<Vec<InventoryLot>, AppError> {
    let rows = sqlx::query_as::<_, InventoryLotRow>(
        "SELECT id, material_id, purchase_invoice_id, movement_id, quantity_original, quantity_remaining, unit_cost_base, raw_unit_cost_base, currency_code, fx_rate, purchase_date, created_at 
         FROM inventory_lots 
         WHERE purchase_invoice_id = ?
         ORDER BY purchase_date ASC"
    )
    .bind(invoice_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    rows.into_iter().map(row_to_inventory_lot).collect()
}

pub async fn count_active_by_material(
    pool: &SqlitePool,
    material_id: &str,
) -> Result<i64, AppError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM inventory_lots WHERE material_id = ? AND CAST(quantity_remaining AS REAL) > 0"
    )
    .bind(material_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(row.0)
}

pub async fn get_costing_method(
    pool: &SqlitePool,
    material_id: &str,
) -> Result<String, AppError> {
    use super::models::CostingMethodRow;
    let row: CostingMethodRow = sqlx::query_as(
        "SELECT costing_method FROM materials WHERE id = ?"
    )
    .bind(material_id)
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(row.costing_method)
}
