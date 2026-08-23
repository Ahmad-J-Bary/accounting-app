use sqlx::SqlitePool;
use application::errors::AppError;
use chrono::{DateTime, Utc};
use domain::accounting::fiscal_period::FiscalPeriodStatus;
use domain::accounting::journal_entry::{JournalEntry, JournalEntryStatus, JournalType};
use domain::settings::START_MODE_EXISTING;
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

/// Rejects persisting a POSTED journal whose accounting date falls in a fiscal
/// period that does not accept posting (Closing / Closed / Locked / Cancelled),
/// or outside every existing period once periods are in use.
///
/// Graduated enforcement so legacy/fresh databases keep working:
///  * Period-exempt journal types (opening balances) skip the check — they are
///    the explicit pre-period setup mechanism.
///  * A contra entry of ANY type (`reversal_of_entry_id` set) also skips the
///    check — reversals are a relationship, and correcting closed/locked
///    financial history is their documented purpose.
///  * If NO fiscal period exists at all, writes are allowed (periods not yet
///    adopted).
///  * Otherwise the entry date must be covered by an Open/Reopened period.
pub(crate) async fn validate_posting_period(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    entry_date: DateTime<Utc>,
    journal_type: JournalType,
    reversal_of_entry_id: Option<&JournalEntryId>,
) -> Result<(), AppError> {
    if journal_type.is_period_exempt() || reversal_of_entry_id.is_some() {
        return Ok(());
    }

    let covering: Vec<String> = sqlx::query_scalar(
        "SELECT status FROM fiscal_periods WHERE start_date <= ? AND end_date >= ?",
    )
    .bind(entry_date.to_rfc3339())
    .bind(entry_date.to_rfc3339())
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if covering.is_empty() {
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM fiscal_periods")
            .fetch_one(&mut **tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        if count == 0 {
            return Ok(());
        }
        return Err(AppError::Forbidden(format!(
            "لا توجد فترة مالية نشطة تغطي تاريخ القيد ({}) — اختر تاريخاً ضمن فترة مالية مفتوحة أو أنشئ فترة تغطيه",
            entry_date.to_rfc3339()
        )));
    }

    if covering
        .iter()
        .any(|s| FiscalPeriodStatus::from_str(s).can_post())
    {
        return Ok(());
    }

    Err(AppError::Forbidden(format!(
        "التاريخ {} يقع في فترة مالية مغلقة أو مقفلة — لا يمكن ترحيل حركات في فترة مغلقة أو مقفلة",
        entry_date.to_rfc3339()
    )))
}

/// Rejects posting NORMAL operational journals while an EXISTING company's
/// opening-balance migration has not been sealed yet (no daily
/// accounting before the opening position is Locked). Opening-workflow
/// journals are exempt two ways:
///  * period exemption (`is_period_exempt`: Cash/Account/Material opening
///    balances), plus any contra entry (`reversal_of_entry_id` set — reversals
///    are a relationship, not a type), and
///  * opening pivot source ids (`opening_balance:`, `residual_classification:`,
///    `ob_reversal:`, `profit_distribution:`) — the residual reclassification
///    posts a `GeneralJournal` while the migration is still Posted, so the gate
///    cannot rely on journal type alone.
///
/// NEW companies never carry a migration, so the gate is a no-op for them.
async fn validate_opening_gate(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    entry: &JournalEntry,
) -> Result<(), AppError> {
    if entry.journal_type.is_period_exempt() || entry.reversal_of_entry_id.is_some() {
        return Ok(());
    }
    if let Some(src) = entry.source_id.as_deref() {
        const OPENING_PIVOTS: [&str; 4] = [
            "opening_balance:",
            "residual_classification:",
            "ob_reversal:",
            "profit_distribution:",
        ];
        if OPENING_PIVOTS.iter().any(|p| src.starts_with(p)) {
            return Ok(());
        }
    }

    let mode: Option<String> =
        sqlx::query_scalar("SELECT accounting_start_mode FROM settings LIMIT 1")
            .fetch_optional(&mut **tx)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    if mode.as_deref() != Some(START_MODE_EXISTING) {
        return Ok(());
    }

    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM opening_balance_migrations WHERE status NOT IN ('Cancelled', 'Locked')",
    )
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    if pending > 0 {
        return Err(AppError::Forbidden(
            "لا يمكن ترحيل حركات يومية قبل إقفال الرصيد الافتتاحي — أكمل تجهيز الرصيد الافتتاحي (التحقق، الترحيل، القفل) ثم أنشئ أول فترة تشغيلية".into(),
        ));
    }
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
    // Posting a journal is gated on the fiscal-period calendar: a Posted entry
    // must belong to an Open/Reopened period (or be a period-exempt opening /
    // reversal). Drafts may be edited freely; they only get checked on posting.
    if entry.status == JournalEntryStatus::Posted {
        validate_posting_period(tx, entry.entry_date, entry.journal_type, entry.reversal_of_entry_id.as_ref()).await?;
        validate_opening_gate(tx, entry).await?;
    }

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
        let insert_result = sqlx::query(
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
        .await;

        match insert_result {
            Ok(_) => {}
            Err(e) if e.to_string().contains("UNIQUE constraint failed") => {
                // Another row with the same (source_type, source_id) exists.
                // This is common when a partner's opening balance is updated:
                // the create step posted the initial journal and the update
                // step now re-posts the adjusted balance.  Instead of
                // surfacing a conflict error we update the existing entry in
                // place so the ledger stays idempotent for the same business
                // event.
                if let (Some(ref st), Some(ref sid)) = (&source_type, &entry.source_id) {
                    let conflict_id: Option<String> = sqlx::query_scalar(
                        "SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ? AND id != ? LIMIT 1"
                    )
                    .bind(st)
                    .bind(sid)
                    .bind(entry.id.0.to_string())
                    .fetch_optional(&mut **tx)
                    .await
                    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

                    if let Some(existing_id) = conflict_id {
                        sqlx::query(
                            "UPDATE journal_entries SET journal_type = ?, entry_number = ?, entry_date = ?, description = ?, status = ?, posted_at = ?, reversed_at = ?, updated_at = ?, reversal_of_entry_id = ? WHERE id = ?"
                        )
                        .bind(format!("{:?}", entry.journal_type))
                        .bind(&entry.entry_number)
                        .bind(entry.entry_date.to_rfc3339())
                        .bind(&entry.description)
                        .bind(format!("{:?}", entry.status))
                        .bind(entry.posted_at.map(|d| d.to_rfc3339()))
                        .bind(entry.reversed_at.map(|d| d.to_rfc3339()))
                        .bind(chrono::Utc::now().to_rfc3339())
                        .bind(entry.reversal_of_entry_id.map(|id| id.0.to_string()))
                        .bind(&existing_id)
                        .execute(&mut **tx)
                        .await
                        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

                        // Replace lines under the existing entry id
                        sqlx::query("DELETE FROM journal_lines WHERE journal_entry_id = ?")
                            .bind(&existing_id)
                            .execute(&mut **tx)
                            .await
                            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

                        for line in &entry.lines {
                            sqlx::query(
                                "INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                            )
                            .bind(Uuid::new_v4().to_string())
                            .bind(&existing_id)
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
                        return Ok(());
                    }
                }
                return Err(duplicate_source(e));
            }
            Err(e) => return Err(duplicate_source(e)),
        }
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

    delete_tx(&mut tx, id).await?;

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}

/// Deletes a journal entry + its lines inside an open transaction, with the
/// same immutability guard as `delete`. `pub(crate)` so composite repository
/// methods (customer/supplier deletion, payment removal) can cascade-cleanse
/// draft journals and their linked partner rows in ONE shared transaction.
pub(crate) async fn delete_tx<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    id: &JournalEntryId,
) -> Result<(), AppError> {
    // Posted entries are part of the auditable financial history: they must
    // not be deleted, only reversed. Reversals may carry their own lifecycle
    // (a reversal entry itself is posted audit trail and is also protected).
    let status: Option<String> = sqlx::query_scalar("SELECT status FROM journal_entries WHERE id = ?")
        .bind(id.0.to_string())
        .fetch_optional(&mut **tx)
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
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query("DELETE FROM journal_entries WHERE id = ?")
        .bind(id.0.to_string())
        .execute(&mut **tx)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(())
}
