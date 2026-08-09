use sqlx::SqlitePool;
use application::errors::AppError;
use domain::assets::{Consumable, ConsumableId, AssetMovement};
use domain::accounting::journal_entry::JournalEntry;

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
    .bind(consumable.unit_cost.currency().code.clone())
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

async fn save_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    consumable: &Consumable,
) -> Result<(), AppError> {
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
    .bind(consumable.unit_cost.currency().code.clone())
    .bind(consumable.fx_rate.to_string())
    .bind(format!("{:?}", consumable.status))
    .bind(&consumable.location)
    .bind(&consumable.notes)
    .bind(consumable.asset_account_id.to_string())
    .bind(consumable.expense_account_id.to_string())
    .bind(consumable.created_at.to_rfc3339())
    .bind(consumable.updated_at.to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically saves the consumable + its asset movements + its journal
/// entries in ONE transaction (Sec 9 atomicity).
pub async fn save_with_accounting(
    pool: &SqlitePool,
    consumable: &Consumable,
    movements: &[AssetMovement],
    entries: &[JournalEntry],
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    save_tx(&mut tx, consumable).await?;
    for movement in movements {
        save_movement_tx(&mut tx, movement).await?;
    }
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn save_movement_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    movement: &AssetMovement,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO asset_movements (id, asset_id, movement_type, movement_date, quantity, amount, currency, description, reference_no, journal_entry_id, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(movement.id.to_string())
    .bind(movement.asset_id.to_string())
    .bind(format!("{:?}", movement.movement_type))
    .bind(movement.date.to_rfc3339())
    .bind(movement.quantity.map(|q| q.to_string()))
    .bind(movement.amount.amount().to_string())
    .bind(movement.amount.currency().code.clone())
    .bind(&movement.description)
    .bind(&movement.reference_no)
    .bind(movement.journal_entry_id.map(|id| id.to_string()))
    .bind(movement.created_at.to_rfc3339())
    .execute(&mut **tx)
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
