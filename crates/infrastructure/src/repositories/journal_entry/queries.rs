use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::{JournalEntryId, AccountId};
use super::models::{JournalEntryRow, JournalLineRow};
use super::mappers::{row_to_entry, row_to_line};

pub async fn find_by_id(pool: &SqlitePool, id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError> {
    let row = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, entry_date, description, status, created_at, posted_at, updated_at FROM journal_entries WHERE id = ?"
    )
    .bind(id.0.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let lines = load_lines(pool, &r.id).await?;
        Ok(Some(row_to_entry(r, lines)?))
    } else {
        Ok(None)
    }
}

pub async fn find_by_number(pool: &SqlitePool, number: &str) -> Result<Option<JournalEntry>, AppError> {
    let row = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, entry_date, description, status, created_at, posted_at, updated_at FROM journal_entries WHERE entry_number = ?"
    )
    .bind(number)
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(r) = row {
        let lines = load_lines(pool, &r.id).await?;
        Ok(Some(row_to_entry(r, lines)?))
    } else {
        Ok(None)
    }
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<JournalEntry>, AppError> {
    let rows = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, entry_date, description, status, created_at, posted_at, updated_at FROM journal_entries ORDER BY entry_date DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = load_lines(pool, &row.id).await?;
        entries.push(row_to_entry(row, lines)?);
    }
    Ok(entries)
}

pub async fn list_by_account(pool: &SqlitePool, account_id: &AccountId) -> Result<Vec<JournalEntry>, AppError> {
    let rows = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT DISTINCT je.id, je.entry_number, je.entry_date, je.description, je.status, je.created_at, je.posted_at, je.updated_at 
         FROM journal_entries je
         JOIN journal_lines jl ON je.id = jl.journal_entry_id
         WHERE jl.account_id = ?
         ORDER BY je.entry_date DESC"
    )
    .bind(account_id.0.to_string())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = load_lines(pool, &row.id).await?;
        entries.push(row_to_entry(row, lines)?);
    }
    Ok(entries)
}

pub async fn load_lines(pool: &SqlitePool, entry_id: &str) -> Result<Vec<JournalLine>, AppError> {
    let rows = sqlx::query_as::<_, JournalLineRow>(
        "SELECT id, account_id, currency, fx_rate, debit, debit_base, credit, credit_base, description FROM journal_lines WHERE journal_entry_id = ?"
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    
    Ok(rows.into_iter().map(row_to_line).collect())
}
