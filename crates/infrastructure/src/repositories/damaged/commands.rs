use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::journal_entry::JournalEntry;
use domain::inventory::stock_movement::StockMovement;
use domain::inventory::DamagedItem;
use domain::shared::ids::{DamagedItemId};

pub async fn save(pool: &SqlitePool, item: &DamagedItem) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO damaged_items (id, material_id, quantity, reason, damage_date, cost_impact, notes, reference, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            material_id = excluded.material_id,
            quantity = excluded.quantity,
            reason = excluded.reason,
            damage_date = excluded.damage_date,
            cost_impact = excluded.cost_impact,
            notes = excluded.notes,
            reference = excluded.reference"
    )
    .bind(item.id.0.to_string())
    .bind(item.material_id.to_string())
    .bind(item.quantity.to_string())
    .bind(&item.reason)
    .bind(item.damage_date.to_rfc3339())
    .bind(item.cost_impact.to_string())
    .bind(&item.notes)
    .bind(&item.reference)
    .bind(item.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically saves the damaged-item doc + its stock movement + its journal
/// entry in ONE transaction, optionally removing prior draft movements and
/// journal entries for the same reference (Sec 9 atomicity).
#[allow(clippy::too_many_arguments)]
pub async fn save_with_accounting(
    pool: &SqlitePool,
    item: &DamagedItem,
    movements: &[StockMovement],
    entries: &[JournalEntry],
    delete_movement_reference: Option<&str>,
    delete_entries: &[domain::shared::ids::JournalEntryId],
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(reference) = delete_movement_reference {
        sqlx::query("DELETE FROM stock_movements WHERE (reference = ? OR document_number = ?) AND movement_type = ?")
            .bind(reference)
            .bind(reference)
            .bind("Damaged")
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    for id in delete_entries {
        sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        sqlx::query("DELETE FROM journal_entries WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }

    sqlx::query(
        "INSERT INTO damaged_items (id, material_id, quantity, reason, damage_date, cost_impact, notes, reference, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(item.id.0.to_string())
    .bind(item.material_id.to_string())
    .bind(item.quantity.to_string())
    .bind(&item.reason)
    .bind(item.damage_date.to_rfc3339())
    .bind(item.cost_impact.to_string())
    .bind(&item.notes)
    .bind(&item.reference)
    .bind(item.created_at.to_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for movement in movements {
        crate::repositories::stock_movement::insert_movement_tx(&mut tx, movement).await?;
    }
    for entry in entries {
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;
    }

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
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
