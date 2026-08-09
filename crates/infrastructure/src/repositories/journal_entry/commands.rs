use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::journal_entry::{JournalEntry};
use domain::shared::{JournalEntryId};
use uuid::Uuid;

pub async fn save(pool: &SqlitePool, entry: &JournalEntry) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    // Immutability guard: a persisted Posted / Reversed entry may only be
    // rewritten through `save_reversal_pair` (the reversal flow). Any other
    // attempt to overwrite posted financial history is rejected here so no
    // use case or UI can silently mutate the ledger.
    let existing: Option<String> = sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
        .bind(entry.id.0.to_string())
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some("Posted" | "Reversed" | "Cancelled") = existing.as_deref() {
        return Err(AppError::Forbidden(
            "لا يمكن تعديل قيد مرحَّل أو ملغى مباشرة؛ استخدم قيد التراجع (Reversal)".into(),
        ));
    }

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

/// Inserts (or refreshes) a journal entry + its lines within an open
/// transaction. `pub(crate)` so composite repository methods across the crate
/// (payment settlements, invoice posting, stock/adjustment/asset events) can
/// write a journal and their business records in ONE shared transaction
/// instead of splitting the accounting event across autocommit connections.
pub(crate) async fn insert_entry(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    entry: &JournalEntry,
) -> Result<(), AppError> {
    // Always persist a source_type. Explicit callers may set it; otherwise the
    // canonical tag for the journal type is used so templates can label entries.
    let source_type = entry.source_type.clone()
        .or_else(|| Some(entry.journal_type.source_type().to_string()));

    // A pre-existing row with the same id is refreshed only when the caller is
    // explicitly persisting that draft again (e.g. journal editing); `save`
    // already rejects overwriting Posted/Reversed/Cancelled. A brand-new row
    // goes through a plain INSERT (never INSERT OR REPLACE) so the database
    // UNIQUE(source_type, source_id) index is a genuine concurrency backstop:
    // a duplicate business event surfaces as AppError::Conflict instead of
    // silently replacing the already-posted journal (Sec 10 / Sec 45).
    let existing_id: Option<String> = sqlx::query_scalar("SELECT id FROM journal_entries WHERE id = ?")
        .bind(entry.id.0.to_string())
        .fetch_optional(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if existing_id.is_some() {
        sqlx::query(
            "UPDATE journal_entries SET journal_type = ?, source_id = ?, source_type = ?, entry_date = ?, description = ?, status = ?, posted_at = ?, reversed_at = ?, updated_at = ?, reversal_of_entry_id = ? WHERE id = ?"
        )
        .bind(format!("{:?}", entry.journal_type))
        .bind(&entry.source_id)
        .bind(&source_type)
        .bind(entry.entry_date.to_rfc3339())
        .bind(&entry.description)
        .bind(format!("{:?}", entry.status))
        .bind(entry.posted_at.map(|d| d.to_rfc3339()))
        .bind(entry.reversed_at.map(|d| d.to_rfc3339()))
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(entry.reversal_of_entry_id.map(|id| id.0.to_string()))
        .bind(entry.id.0.to_string())
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    } else {
        sqlx::query(
            "INSERT INTO journal_entries (id, entry_number, journal_type, source_id, source_type, entry_date, description, status, created_at, posted_at, reversed_at, updated_at, reversal_of_entry_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        .bind(entry.reversed_at.map(|d| d.to_rfc3339()))
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(entry.reversal_of_entry_id.map(|id| id.0.to_string()))
        .execute(&mut **tx)
        .await
        .map_err(duplicate_source)?;
    }

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

/// Maps a duplicate (source_type, source_id) insert to an actionable conflict.
fn duplicate_source(e: sqlx::Error) -> AppError {
    if e.to_string().contains("UNIQUE constraint failed") {
        AppError::Conflict(
            "حدث مالي مكرر: يوجد قيد مرحَّل لهذا الحدث (source_type/source_id) — لم يتم إنشاء قيد جديد".into(),
        )
    } else {
        AppError::Infrastructure(e.to_string())
    }
}

pub async fn delete(pool: &SqlitePool, id: &JournalEntryId) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    // Posted entries are part of the auditable financial history: they must
    // not be deleted, only reversed. Reversals may carry their own lifecycle
    // (a reversal entry itself is posted audit trail and is also protected).
    let status: Option<String> = sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
        .bind(id.0.to_string())
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if let Some(status) = status.as_deref() {
        if status == "Posted" || status == "Reversed" || status == "Cancelled" {
            return Err(AppError::Forbidden(
                "لا يمكن حذف قيد مرحَّل أو ملغى؛ استخدم قيد التراجع (Reversal)".into(),
            ));
        }
    }

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
