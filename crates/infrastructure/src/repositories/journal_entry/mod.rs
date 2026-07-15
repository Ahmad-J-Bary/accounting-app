use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::journal_entry::{JournalEntry};
use domain::shared::{JournalEntryId, AccountId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

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
        commands::save(&self.pool, entry).await
    }

    async fn find_by_id(&self, id: &JournalEntryId) -> Result<Option<JournalEntry>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_number(&self, number: &str) -> Result<Option<JournalEntry>, AppError> {
        queries::find_by_number(&self.pool, number).await
    }

    async fn list_all(&self) -> Result<Vec<JournalEntry>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn list_by_account(&self, account_id: &AccountId) -> Result<Vec<JournalEntry>, AppError> {
        queries::list_by_account(&self.pool, account_id).await
    }

    async fn list_by_accounts(&self, account_ids: &[AccountId]) -> Result<Vec<JournalEntry>, AppError> {
        queries::list_by_accounts(&self.pool, account_ids).await
    }

    async fn list_with_filters(
        &self,
        from_date: Option<chrono::DateTime<chrono::Utc>>,
        to_date: Option<chrono::DateTime<chrono::Utc>>,
        journal_type: Option<domain::accounting::JournalType>,
        account_id: Option<AccountId>,
        partner_id: Option<uuid::Uuid>,
        status: Option<domain::accounting::JournalEntryStatus>,
    ) -> Result<Vec<JournalEntry>, AppError> {
        queries::list_with_filters(
            &self.pool,
            from_date,
            to_date,
            journal_type,
            account_id,
            partner_id,
            status,
        )
        .await
    }

    async fn get_next_entry_number(&self) -> Result<String, AppError> {
        queries::get_next_entry_number(&self.pool).await
    }

    async fn find_by_source_id(&self, source_id: &str) -> Result<Option<JournalEntry>, AppError> {
        queries::find_by_source_id(&self.pool, source_id).await
    }

    async fn find_all_by_source_id(&self, source_id: &str) -> Result<Vec<JournalEntry>, AppError> {
        queries::find_all_by_source_id(&self.pool, source_id).await
    }

    async fn delete(&self, id: &JournalEntryId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }
}
