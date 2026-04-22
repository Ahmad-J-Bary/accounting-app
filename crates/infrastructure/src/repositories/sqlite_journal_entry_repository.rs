use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::{JournalEntryId, AccountId};
use domain::shared::Money;
use std::sync::Arc;
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::DateTime;
use uuid::Uuid;

pub struct SqliteJournalEntryRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteJournalEntryRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct JournalEntryRow {
    id: String,
    entry_number: String,
    entry_date: String,
    description: String,
    status: String,
    created_at: String,
    posted_at: Option<String>,
    updated_at: String,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
struct JournalLineRow {
    id: String,
    account_id: String,
    debit: String,
    credit: String,
    description: String,
}

#[async_trait]
impl JournalEntryRepository for SqliteJournalEntryRepository {
    async fn save(&self, entry: &JournalEntry) -> Result<(), AppError> {
        let mut tx = self.pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "INSERT OR REPLACE INTO journal_entries (id, entry_number, entry_date, description, status, created_at, posted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(entry.id.0.to_string())
        .bind(&entry.entry_number)
        .bind(entry.entry_date.to_rfc3339())
        .bind(&entry.description)
        .bind(format!("{:?}", entry.status))
        .bind(entry.created_at.to_rfc3339())
        .bind(entry.posted_at.map(|d| d.to_rfc3339()))
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        // Delete old lines
        sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
            .bind(entry.id.0.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for line in &entry.lines {
            sqlx::query(
                "INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(Uuid::new_v4().to_string())
            .bind(entry.id.0.to_string())
            .bind(line.account_id.0.to_string())
            .bind(line.debit.amount().to_string())
            .bind(line.credit.amount().to_string())
            .bind(&line.description)
            .bind(chrono::Utc::now().to_rfc3339())
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError> {
        let row = sqlx::query_as::<_, JournalEntryRow>(
            "SELECT id, entry_number, entry_date, description, status, created_at, posted_at, updated_at FROM journal_entries WHERE id = ?"
        )
        .bind(id.0.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = row {
            let lines = self.load_lines(&row.id).await?;
            Ok(Some(self.map_row(row, lines)?))
        } else {
            Ok(None)
        }
    }

    async fn find_by_number(&self, number: &str) -> Result<Option<JournalEntry>, AppError> {
        let row = sqlx::query_as::<_, JournalEntryRow>(
            "SELECT id, entry_number, entry_date, description, status, created_at, posted_at, updated_at FROM journal_entries WHERE entry_number = ?"
        )
        .bind(number)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        if let Some(row) = row {
            let lines = self.load_lines(&row.id).await?;
            Ok(Some(self.map_row(row, lines)?))
        } else {
            Ok(None)
        }
    }

    async fn list_all(&self) -> Result<Vec<JournalEntry>, AppError> {
        let rows = sqlx::query_as::<_, JournalEntryRow>(
            "SELECT id, entry_number, entry_date, description, status, created_at, posted_at, updated_at FROM journal_entries ORDER BY entry_date DESC"
        )
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        let mut entries = Vec::new();
        for row in rows {
            let lines = self.load_lines(&row.id).await?;
            entries.push(self.map_row(row, lines)?);
        }
        Ok(entries)
    }

    async fn delete(&self, id: &JournalEntryId) -> Result<(), AppError> {
        sqlx::query("DELETE FROM journal_entries WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&*self.pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }
}

impl SqliteJournalEntryRepository {
    async fn load_lines(&self, entry_id: &str) -> Result<Vec<JournalLine>, AppError> {
        let rows = sqlx::query_as::<_, JournalLineRow>(
            "SELECT id, account_id, debit, credit, description FROM journal_lines WHERE journal_entry_id = ?"
        )
        .bind(entry_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        
        let mut lines = Vec::new();
        for r in rows {
            let account_id = AccountId(Uuid::parse_str(&r.account_id).unwrap_or_default());
            let debit = Money::new(Decimal::from_str(&r.debit).unwrap_or(Decimal::ZERO));
            let credit = Money::new(Decimal::from_str(&r.credit).unwrap_or(Decimal::ZERO));
            lines.push(JournalLine::new(account_id, debit, credit, r.description));
        }
        Ok(lines)
    }
    
    fn map_row(&self, row: JournalEntryRow, lines: Vec<JournalLine>) -> Result<JournalEntry, AppError> {
        let date = DateTime::parse_from_rfc3339(&row.entry_date)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        
        let mut entry = JournalEntry::new(
            row.entry_number,
            lines,
            date,
            row.description,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;
        
        // Reconstruct from DB
        entry.id = JournalEntryId(Uuid::parse_str(&row.id).unwrap_or_default());
        let _ = entry.created_at; // ignore new value
        entry.created_at = DateTime::parse_from_rfc3339(&row.created_at)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
            
        entry.posted_at = row.posted_at.and_then(|d| DateTime::parse_from_rfc3339(&d).ok())
            .map(|d| d.with_timezone(&chrono::Utc));
            
        entry.status = match row.status.as_str() {
            "Posted" => domain::accounting::journal_entry::JournalEntryStatus::Posted,
            "Cancelled" => domain::accounting::journal_entry::JournalEntryStatus::Cancelled,
            _ => domain::accounting::journal_entry::JournalEntryStatus::Draft,
        };

        Ok(entry)
    }
}
