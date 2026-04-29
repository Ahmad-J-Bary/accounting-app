use sqlx::SqlitePool;
use application::errors::AppError;
use domain::assets::{Consumable, ConsumableId};

pub async fn save(pool: &SqlitePool, consumable: &Consumable) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO consumables (id, code, name, category_id, quantity_on_hand, unit_cost, currency, fx_rate, status, location, notes, asset_account_id, expense_account_id, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(consumable.id.0.to_string())
    .bind(&consumable.code)
    .bind(&consumable.name)
    .bind(consumable.category_id.to_string())
    .bind(consumable.quantity_on_hand.to_string())
    .bind(consumable.unit_cost.amount().to_string())
    .bind(consumable.unit_cost.currency().code().to_string())
    .bind(consumable.fx_rate.to_string())
    .bind(format!("{:?}", consumable.status))
    .bind(&consumable.location)
    .bind(&consumable.notes)
    .bind(consumable.asset_account_id.to_string())
    .bind(consumable.expense_account_id.to_string())
    .bind(consumable.created_at.to_rfc3339())
    .bind(consumable.updated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &ConsumableId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM consumables WHERE id = ?")
        .bind(id.0.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
