use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::journal_entry::JournalEntry;
use domain::inventory::stock_movement::StockMovement;
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

/// Atomically saves the adjustment doc + its stock movement + its journal
/// entry in ONE transaction, optionally removing prior draft movements and
/// journal entries for the same reference (Sec 9 atomicity).
#[allow(clippy::too_many_arguments)]
pub async fn save_with_accounting(
    pool: &SqlitePool,
    adj: &StockAdjustment,
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
            .bind("Adjustment")
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

pub async fn delete(pool: &SqlitePool, id: &StockAdjustmentId) -> Result<(), AppError> {
    sqlx::query("DELETE FROM stock_adjustments WHERE id = ?")
        .bind(id.to_string())
        .execute(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
