use std::sync::Arc;
use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use domain::accounting::journal_entry::JournalEntry;
use domain::accounting::OpeningBalanceMigration;
use uuid::Uuid;

/// Persists the opening-balance journal entry and marks the migration as Posted
/// inside a single SQLite transaction (atomicity).
pub struct SqliteOpeningPostingRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteOpeningPostingRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl OpeningPostingRepository for SqliteOpeningPostingRepository {
    async fn post(&self, migration: &OpeningBalanceMigration, entry: &JournalEntry) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query(
            "INSERT OR REPLACE INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(entry.id.0.to_string())
        .bind(&entry.entry_number)
        .bind(format!("{:?}", entry.journal_type))
        .bind(&entry.source_id)
        .bind(entry.entry_date.to_rfc3339())
        .bind(&entry.description)
        .bind(format!("{:?}", entry.status))
        .bind(entry.created_at.to_rfc3339())
        .bind(entry.posted_at.map(|d| d.to_rfc3339()))
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
            .bind(entry.id.0.to_string())
            .execute(&mut *tx)
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
            .execute(&mut *tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        }

        sqlx::query(
            "UPDATE opening_balance_migrations SET status = 'Posted', posted_at = ?, updated_at = ? WHERE id = ?"
        )
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(&migration.id)
        .execute(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        Ok(())
    }
}