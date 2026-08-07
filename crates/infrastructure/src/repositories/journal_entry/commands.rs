use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::journal_entry::{JournalEntry};
use domain::shared::{JournalEntryId};
use uuid::Uuid;

pub async fn save(pool: &SqlitePool, entry: &JournalEntry) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    insert_entry(&mut tx, entry).await?;
    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Atomically persist `reversal` and its `original` (which was marked Reversed)
/// in one transaction: either both rows are written or neither is.
pub async fn save_reversal_pair(
    pool: &SqlitePool,
    reversal: &JournalEntry,
    original: &JournalEntry,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    insert_entry(&mut tx, reversal).await?;
    insert_entry(&mut tx, original).await?;
    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

async fn insert_entry(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    entry: &JournalEntry,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR REPLACE INTO journal_entries (id, entry_number, journal_type, source_id, source_type, entry_date, description, status, created_at, posted_at, reversed_at, updated_at, reversal_of_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(entry.id.0.to_string())
    .bind(&entry.entry_number)
    .bind(format!("{:?}", entry.journal_type))
    .bind(&entry.source_id)
    .bind(&entry.source_type)
    .bind(entry.entry_date.to_rfc3339())
    .bind(&entry.description)
    .bind(format!("{:?}", entry.status))
    .bind(entry.created_at.to_rfc3339())
    .bind(entry.posted_at.map(|d| d.to_rfc3339()))
    .bind(entry.reversed_at.map(|d| d.to_rfc3339()))
    .bind(chrono::Utc::now().to_rfc3339())
    .bind(entry.reversal_of_entry_id.map(|id| id.0.to_string()))
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
        .bind(entry.id.0.to_string())
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    for line in &entry.lines {
        sqlx::query(
            "INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(entry.id.0.to_string())
        .bind(line.account_id.0.to_string())
        .bind(line.partner_id.map(|id| id.to_string()))
        .bind(&line.debit.currency().code)
        .bind(line.debit.fx_rate.to_string())
        .bind(line.debit.amount().to_string())
        .bind(line.debit.base_amount.to_string())
        .bind(line.credit.amount().to_string())
        .bind(line.credit.base_amount.to_string())
        .bind(&line.description)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &JournalEntryId) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

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

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
