use std::sync::Arc;
use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use domain::accounting::journal_entry::JournalEntry;
use domain::accounting::OpeningBalanceMigration;

/// Persists an opening-balance journal entry and marks the migration as Posted
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

        // Shared journal persistence (single INSERT guaranteed by the schema
        // UNIQUE(source_type, source_id) index). Opening aggregate journals
        // (AccountOpeningBalance) and contra/reclassification pairs are
        // period-exempt (type) or reversal-linked (relationship), so
        // fiscal-period gating in `insert_entry` never blocks an opening
        // lifecycle write here.
        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;

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

    async fn cancel(
        &self,
        migration: &OpeningBalanceMigration,
        reversal: &JournalEntry,
        original: &JournalEntry,
    ) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        // A cancellation is a full reversal pair: persist the contra AND mark
        // the original aggregate Reversed in the same transaction (audit trail,
        // atomic; nothing is deleted).
        crate::repositories::journal_entry::insert_entry(&mut tx, reversal).await?;
        crate::repositories::journal_entry::insert_entry(&mut tx, original).await?;

        sqlx::query(
            "UPDATE opening_balance_migrations SET status = 'Cancelled', posted_at = ?, updated_at = ? WHERE id = ?"
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

    async fn apply_residual(&self, migration: &OpeningBalanceMigration, entry: &JournalEntry) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        crate::repositories::journal_entry::insert_entry(&mut tx, entry).await?;

        sqlx::query(
            "UPDATE opening_balance_migrations SET residual_applied_at = ?, updated_at = ? WHERE id = ?"
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