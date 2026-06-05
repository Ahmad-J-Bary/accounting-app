use sqlx::SqlitePool;
use application::errors::AppError;
use domain::inventory::DamagedItem;
use domain::shared::ids::{DamagedItemId};

pub async fn save(pool: &SqlitePool, item: &DamagedItem) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO damaged_items (id, material_id, quantity, reason, damage_date, cost_impact, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            material_id = excluded.material_id,
            quantity = excluded.quantity,
            reason = excluded.reason,
            damage_date = excluded.damage_date,
            cost_impact = excluded.cost_impact,
            notes = excluded.notes"
    )
    .bind(item.id.0.to_string())
    .bind(item.material_id.to_string())
    .bind(item.quantity.to_string())
    .bind(&item.reason)
    .bind(item.damage_date.to_rfc3339())
    .bind(item.cost_impact.to_string())
    .bind(&item.notes)
    .bind(item.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &DamagedItemId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM damaged_items WHERE id = ?")
        .bind(id.0.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
