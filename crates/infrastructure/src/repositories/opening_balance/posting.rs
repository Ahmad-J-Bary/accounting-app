use std::sync::Arc;
use async_trait::async_trait;
use sqlx::{SqlitePool, Transaction};
use sqlx::sqlite::Sqlite;
use application::errors::AppError;
use application::ports::opening_posting_repository::OpeningPostingRepository;
use domain::accounting::journal_entry::JournalEntry;
use domain::accounting::OpeningBalanceMigration;
use uuid::Uuid;

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

/// Inserts a journal entry (header + lines) within an open transaction.
async fn insert_journal<'a>(
    tx: &mut Transaction<'a, Sqlite>,
    entry: &JournalEntry,
) -> Result<(), AppError> {
    // Canonical tag default (same rule as the general journal repository): a
    // caller-provided source_type wins; otherwise persist the type's canonical
    // snake_case tag so `source_type` is never NULL going forward.
    let source_type = entry
        .source_type
        .clone()
        .or_else(|| Some(entry.journal_type.source_type().to_string()));

    // Plain INSERT (never INSERT OR REPLACE): the schema-level
    // UNIQUE(source_type, source_id) index is the backstop against a
    // double-click / retry re-posting the same opening-balance event. REPLACE
    // would silently delete the previously posted journal and deny its
    // reversibility — always forbidden for the authoritative ledger.
    sqlx::query(
        "INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type, entry_date, description, status, created_at, posted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(entry.id.0.to_string())
    .bind(&entry.entry_number)
    .bind(format!("{:?}", entry.journal_type))
    .bind(&entry.source_id)
    .bind(&source_type)
    .bind(entry.entry_date.to_rfc3339())
    .bind(&entry.description)
    .bind(format!("{:?}", entry.status))
    .bind(entry.created_at.to_rfc3339())
    .bind(entry.posted_at.map(|d| d.to_rfc3339()))
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(&mut **tx)
    .await
    .map_err(duplicate_journal)?;

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

/// A re-submitted opening-balance journal (duplicate on the
/// UNIQUE(source_type, source_id) index) must surface as a conflict, never as
/// a silent REPLACE of the authoritative opening journal (Sec 10 / Sec 45).
fn duplicate_journal(e: sqlx::Error) -> AppError {
    if e.to_string().contains("UNIQUE constraint failed") {
        AppError::Conflict(
            "حدث افتتاحي مكرر: يوجد قيد مرحَّل لهذا الحدث — لم يتم إنشاء قيد جديد".into(),
        )
    } else {
        AppError::Infrastructure(e.to_string())
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

        insert_journal(&mut tx, entry).await?;

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

    async fn cancel(&self, migration: &OpeningBalanceMigration, reversal: &JournalEntry) -> Result<(), AppError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        insert_journal(&mut tx, reversal).await?;

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

        insert_journal(&mut tx, entry).await?;

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