use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::inventory_lot::InventoryLot;

pub async fn save(pool: &SqlitePool, lot: &InventoryLot) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO inventory_lots (id, material_id, purchase_invoice_id, movement_id, quantity_original, quantity_remaining, unit_cost_base, raw_unit_cost_base, currency_code, fx_rate, purchase_date, created_at, retail_price_base, semi_wholesale_price_base, wholesale_price_base)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(lot.id.to_string())
    .bind(lot.material_id.to_string())
    .bind(lot.purchase_invoice_id.map(|id| id.to_string()))
    .bind(lot.movement_id.to_string())
    .bind(lot.quantity_original.to_string())
    .bind(lot.quantity_remaining.to_string())
    .bind(lot.unit_cost_base.to_string())
    .bind(lot.raw_unit_cost_base.to_string())
    .bind(&lot.currency_code)
    .bind(lot.fx_rate.to_string())
    .bind(lot.purchase_date.to_rfc3339())
    .bind(lot.created_at.to_rfc3339())
    .bind(lot.retail_price_base.map(|v| v.to_string()))
    .bind(lot.semi_wholesale_price_base.map(|v| v.to_string()))
    .bind(lot.wholesale_price_base.map(|v| v.to_string()))
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn update_sale_prices(pool: &SqlitePool, lot_id: &str, retail: Option<&str>, semi_wholesale: Option<&str>, wholesale: Option<&str>) -> Result<(), AppError> {
    sqlx::query("UPDATE inventory_lots SET retail_price_base = ?, semi_wholesale_price_base = ?, wholesale_price_base = ? WHERE id = ?")
        .bind(retail)
        .bind(semi_wholesale)
        .bind(wholesale)
        .bind(lot_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn update_remaining(pool: &SqlitePool, lot_id: &str, new_quantity_remaining: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE inventory_lots SET quantity_remaining = ? WHERE id = ?")
        .bind(new_quantity_remaining)
        .bind(lot_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn delete_by_movement_id(pool: &SqlitePool, movement_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM inventory_lots WHERE movement_id = ?")
        .bind(movement_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn delete_by_purchase_invoice(
    pool: &SqlitePool,
    invoice_id: &str,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM inventory_lots WHERE purchase_invoice_id = ?")
        .bind(invoice_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn delete_by_material(pool: &SqlitePool, material_id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM inventory_lots WHERE material_id = ?")
        .bind(material_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}

pub async fn update_costing_method(
    pool: &SqlitePool,
    material_id: &str,
    costing_method: &str,
) -> Result<(), AppError> {
    sqlx::query("UPDATE materials SET costing_method = ? WHERE id = ?")
        .bind(costing_method)
        .bind(material_id)
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}
