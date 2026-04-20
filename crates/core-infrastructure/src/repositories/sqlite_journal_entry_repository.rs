use async_trait::async_trait;
use sqlx::SqlitePool;
use core_application::errors::AppError;
use core_application::ports::journal_entry_repository::JournalEntryRepository;
use core_domain::accounting::journal_entry::JournalEntry;
use core_domain::shared::JournalEntryId;
use std::sync::Arc;

pub struct SqliteJournalEntryRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteJournalEntryRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl JournalEntryRepository for SqliteJournalEntryRepository {
    async fn save(&self, entry: &JournalEntry) -> Result<(), AppError> {
        sqlx::query(
            "INSERT INTO journal_entries (id, entry_number, entry_date, description, status, created_at, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(entry.id.0.to_string())
        .bind(&entry.entry_number)
        .bind(entry.entry_date)
        .bind(&entry.description)
        .bind(format!("{:?}", entry.status))
        .bind(entry.created_at)
        .bind(entry.posted_at)
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, _id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError> {
        // TODO: Implement database read
        Ok(None)
    }

    async fn find_by_number(&self, _number: &str) -> Result<Option<JournalEntry>, AppError> {
        // TODO: Implement database read
        Ok(None)
    }

    async fn list_all(&self) -> Result<Vec<JournalEntry>, AppError> {
        // TODO: Implement database read
        Ok(vec![])
    }

    async fn delete(&self, _id: &JournalEntryId) -> Result<(), AppError> {
        // TODO: Implement database delete
        Ok(())
    }
}
