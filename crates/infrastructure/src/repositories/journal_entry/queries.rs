use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType, JournalEntryStatus};
use domain::shared::{JournalEntryId, AccountId};
use super::models::{JournalEntryRow, JournalLineRow};
use super::mappers::{row_to_entry, row_to_line};
use chrono::{DateTime, Utc};

pub async fn find_by_id(pool: &SqlitePool, id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError> {
    let row = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, journal_type, source_id, source_type, reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at FROM journal_entries WHERE id = ?"
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
        "SELECT id, entry_number, journal_type, source_id, source_type, reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at FROM journal_entries WHERE entry_number = ?"
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

pub async fn find_by_source_id(pool: &SqlitePool, source_id: &str) -> Result<Option<JournalEntry>, AppError> {
    let row = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, journal_type, source_id, source_type, reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at FROM journal_entries WHERE source_id = ?"
    )
    .bind(source_id)
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

pub async fn find_all_by_source_id(pool: &SqlitePool, source_id: &str) -> Result<Vec<JournalEntry>, AppError> {
    let rows = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, journal_type, source_id, source_type, reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at FROM journal_entries WHERE source_id = ? ORDER BY created_at ASC"
    )
    .bind(source_id)
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

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<JournalEntry>, AppError> {
    let rows = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, journal_type, source_id, source_type, reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at FROM journal_entries ORDER BY entry_date DESC"
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
        "SELECT DISTINCT je.id, je.entry_number, je.journal_type, je.source_id, je.source_type, je.reversal_of_entry_id, je.entry_date, je.description, je.status, je.created_at, je.posted_at, je.reversed_at, je.updated_at 
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

pub async fn list_by_accounts(pool: &SqlitePool, account_ids: &[AccountId]) -> Result<Vec<JournalEntry>, AppError> {
    if account_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = account_ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT DISTINCT je.id, je.entry_number, je.journal_type, je.source_id, je.source_type, je.reversal_of_entry_id, je.entry_date, je.description, je.status, je.created_at, je.posted_at, je.reversed_at, je.updated_at 
         FROM journal_entries je
         JOIN journal_lines jl ON je.id = jl.journal_entry_id
         WHERE jl.account_id IN ({})
           AND je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
         ORDER BY je.entry_date ASC",
        placeholders.join(",")
    );

    let mut query = sqlx::query_as::<_, JournalEntryRow>(&sql);
    for aid in account_ids {
        query = query.bind(aid.0.to_string());
    }

    let rows = query
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

pub async fn list_with_filters(
    pool: &SqlitePool,
    from_date: Option<DateTime<Utc>>,
    to_date: Option<DateTime<Utc>>,
    journal_type: Option<JournalType>,
    account_id: Option<AccountId>,
    partner_id: Option<uuid::Uuid>,
    status: Option<JournalEntryStatus>,
) -> Result<Vec<JournalEntry>, AppError> {
    let mut query_str = "SELECT DISTINCT je.id, je.entry_number, je.journal_type, je.source_id, je.source_type, je.reversal_of_entry_id, je.entry_date, je.description, je.status, je.created_at, je.posted_at, je.reversed_at, je.updated_at FROM journal_entries je JOIN journal_lines jl ON je.id = jl.journal_entry_id WHERE 1=1".to_string();
    
    if from_date.is_some() { query_str.push_str(" AND je.entry_date >= ?"); }
    if to_date.is_some() { query_str.push_str(" AND je.entry_date <= ?"); }
    if let Some(jt) = journal_type {
        if jt != JournalType::GeneralJournal {
            query_str.push_str(" AND je.journal_type = ?");
        }
    }
    if account_id.is_some() { query_str.push_str(" AND jl.account_id = ?"); }
    if partner_id.is_some() { query_str.push_str(" AND jl.partner_id = ?"); }
    if status.is_some() { query_str.push_str(" AND je.status = ?"); }
    
    query_str.push_str(" ORDER BY CAST(je.entry_number AS INTEGER) DESC");

    let mut query = sqlx::query_as::<_, JournalEntryRow>(&query_str);
    
    if let Some(date) = from_date { query = query.bind(date.to_rfc3339()); }
    if let Some(date) = to_date { query = query.bind(date.to_rfc3339()); }
    if let Some(jt) = journal_type {
        if jt != JournalType::GeneralJournal {
            query = query.bind(format!("{:?}", jt));
        }
    }
    if let Some(acc_id) = account_id { query = query.bind(acc_id.0.to_string()); }
    if let Some(part_id) = partner_id { query = query.bind(part_id.to_string()); }
    if let Some(s) = status { query = query.bind(format!("{:?}", s)); }

    let rows = query.fetch_all(pool).await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = load_lines(pool, &row.id).await?;
        entries.push(row_to_entry(row, lines)?);
    }
    Ok(entries)
}

pub async fn get_next_entry_number(pool: &SqlitePool) -> Result<String, AppError> {
    let row: (Option<i64>,) = sqlx::query_as("SELECT MAX(CAST(entry_number AS INTEGER)) FROM journal_entries")
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    
    let next = match row.0 {
        Some(n) => n + 1,
        None => 1,
    };
    Ok(next.to_string())
}

pub async fn load_lines(pool: &SqlitePool, entry_id: &str) -> Result<Vec<JournalLine>, AppError> {
    let rows = sqlx::query_as::<_, JournalLineRow>(
        "SELECT id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description FROM journal_lines WHERE journal_entry_id = ?"
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    
    Ok(rows.into_iter().map(row_to_line).collect())
}
