use super::mappers::{row_to_entry, row_to_line};
use super::models::{JournalEntryRow, JournalLineRow};
use application::errors::AppError;
use application::ports::journal_entry_repository::{AccountAggregationRow, ReversalScope};
use chrono::{DateTime, Utc};
use domain::accounting::journal_entry::{
    JournalEntry, JournalEntryStatus, JournalLine, JournalType,
};
use domain::shared::{AccountId, JournalEntryId};
use rust_decimal::Decimal;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::str::FromStr;

const LINES_BATCH_SIZE: usize = 500;

pub async fn find_by_id(
    pool: &SqlitePool,
    id: &JournalEntryId,
) -> Result<Option<JournalEntry>, AppError> {
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

pub async fn find_by_number(
    pool: &SqlitePool,
    number: &str,
) -> Result<Option<JournalEntry>, AppError> {
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

pub async fn find_by_source_id(
    pool: &SqlitePool,
    source_id: &str,
) -> Result<Option<JournalEntry>, AppError> {
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

pub async fn find_all_by_source_id(
    pool: &SqlitePool,
    source_id: &str,
) -> Result<Vec<JournalEntry>, AppError> {
    let rows = sqlx::query_as::<_, JournalEntryRow>(
        "SELECT id, entry_number, journal_type, source_id, source_type, reversal_of_entry_id, entry_date, description, status, created_at, posted_at, reversed_at, updated_at FROM journal_entries WHERE source_id = ? ORDER BY created_at ASC"
    )
    .bind(source_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let entry_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let lines_map = load_lines_batch(pool, &entry_ids).await?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = lines_map.get(&row.id).cloned().unwrap_or_default();
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

    let entry_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let lines_map = load_lines_batch(pool, &entry_ids).await?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = lines_map.get(&row.id).cloned().unwrap_or_default();
        entries.push(row_to_entry(row, lines)?);
    }
    Ok(entries)
}

pub async fn list_by_account(
    pool: &SqlitePool,
    account_id: &AccountId,
) -> Result<Vec<JournalEntry>, AppError> {
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

    let entry_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let lines_map = load_lines_batch(pool, &entry_ids).await?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = lines_map.get(&row.id).cloned().unwrap_or_default();
        entries.push(row_to_entry(row, lines)?);
    }
    Ok(entries)
}

/// GENERAL LEDGER feed — the POSTED-LEDGER policy (see `ReversalScope`):
/// only Posted entries with no reversal relationship. A Draft / Cancelled /
/// Reversed original and either side of a reversal pair must never reach the
/// account ledger.
pub async fn list_by_accounts(
    pool: &SqlitePool,
    account_ids: &[AccountId],
) -> Result<Vec<JournalEntry>, AppError> {
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

    let entry_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let lines_map = load_lines_batch(pool, &entry_ids).await?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = lines_map.get(&row.id).cloned().unwrap_or_default();
        entries.push(row_to_entry(row, lines)?);
    }
    Ok(entries)
}

#[allow(clippy::too_many_arguments)]
pub async fn list_with_filters(
    pool: &SqlitePool,
    from_date: Option<DateTime<Utc>>,
    to_date: Option<DateTime<Utc>>,
    journal_type: Option<JournalType>,
    account_id: Option<AccountId>,
    partner_id: Option<uuid::Uuid>,
    status: Option<JournalEntryStatus>,
    reversal_scope: ReversalScope,
) -> Result<Vec<JournalEntry>, AppError> {
    let mut query_str = "SELECT DISTINCT je.id, je.entry_number, je.journal_type, je.source_id, je.source_type, je.reversal_of_entry_id, je.entry_date, je.description, je.status, je.created_at, je.posted_at, je.reversed_at, je.updated_at FROM journal_entries je JOIN journal_lines jl ON je.id = jl.journal_entry_id WHERE 1=1".to_string();

    if from_date.is_some() {
        query_str.push_str(" AND je.entry_date >= ?");
    }
    if to_date.is_some() {
        query_str.push_str(" AND je.entry_date <= ?");
    }
    if let Some(jt) = journal_type {
        if jt != JournalType::GeneralJournal {
            query_str.push_str(" AND je.journal_type = ?");
        }
    }
    if account_id.is_some() {
        query_str.push_str(" AND jl.account_id = ?");
    }
    if partner_id.is_some() {
        query_str.push_str(" AND jl.partner_id = ?");
    }
    if status.is_some() {
        query_str.push_str(" AND je.status = ?");
    }
    // The POSTED-LEDGER scope hides both sides of a reversal pair (the
    // Reversed original and the Posted contra journal) — the explicit policy
    // for GL / Trial Balance / Balance Sheet / net-profit feeds. The `All`
    // scope keeps them for the management list / audit archive.
    if reversal_scope == ReversalScope::PostedLedger {
        query_str.push_str(" AND je.reversal_of_entry_id IS NULL");
    }

    query_str.push_str(" ORDER BY CAST(je.entry_number AS INTEGER) DESC");

    let mut query = sqlx::query_as::<_, JournalEntryRow>(&query_str);

    if let Some(date) = from_date {
        query = query.bind(date.to_rfc3339());
    }
    if let Some(date) = to_date {
        query = query.bind(date.to_rfc3339());
    }
    if let Some(jt) = journal_type {
        if jt != JournalType::GeneralJournal {
            query = query.bind(format!("{:?}", jt));
        }
    }
    if let Some(acc_id) = account_id {
        query = query.bind(acc_id.0.to_string());
    }
    if let Some(part_id) = partner_id {
        query = query.bind(part_id.to_string());
    }
    if let Some(s) = status {
        query = query.bind(format!("{:?}", s));
    }

    let rows = query
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let entry_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let lines_map = load_lines_batch(pool, &entry_ids).await?;

    let mut entries = Vec::new();
    for row in rows {
        let lines = lines_map.get(&row.id).cloned().unwrap_or_default();
        entries.push(row_to_entry(row, lines)?);
    }
    Ok(entries)
}

pub async fn get_next_entry_number(pool: &SqlitePool) -> Result<String, AppError> {
    // A real allocated sequence (migration 160): seed once, always stay ahead
    // of any number written outside the sequence (legacy rows, migration 158's
    // generated numbers), persist the increment, and return the allocated
    // number. The transaction makes retrieval + increment atomic, so two
    // concurrent journal-creation flows can never receive the same number —
    // the UNIQUE entry_number constraint stays an assertion, not the allocator.
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let result = get_next_entry_number_in_tx_inner(&mut tx).await;

    tx.commit()
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    result
}

/// Transaction-aware variant of [`get_next_entry_number`]. Executes the
/// sequence increment inside the caller's transaction so it can be used by
/// atomic composite operations (e.g. fiscal year close) that must hold a
/// single write lock throughout.
pub async fn get_next_entry_number_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<String, AppError> {
    get_next_entry_number_in_tx_inner(tx).await
}

async fn get_next_entry_number_in_tx_inner(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<String, AppError> {
    sqlx::query(
        "INSERT INTO journal_numbering (id, next_value) VALUES (1, COALESCE((SELECT MAX(CAST(entry_number AS INTEGER)) FROM journal_entries), 0) + 1) ON CONFLICT(id) DO NOTHING"
    )
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query(
        "UPDATE journal_numbering SET next_value = MAX(next_value, (SELECT COALESCE(MAX(CAST(entry_number AS INTEGER)), 0) FROM journal_entries) + 1) WHERE id = 1"
    )
    .execute(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let next_value: i64 = sqlx::query_scalar(
        "UPDATE journal_numbering SET next_value = next_value + 1 WHERE id = 1 RETURNING next_value"
    )
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok((next_value - 1).to_string())
}

pub async fn load_lines(pool: &SqlitePool, entry_id: &str) -> Result<Vec<JournalLine>, AppError> {
    let rows = sqlx::query_as::<_, JournalLineRow>(
        "SELECT id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description FROM journal_lines WHERE journal_entry_id = ?"
    )
    .bind(entry_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows.into_iter().map(row_to_line).collect())
}

pub async fn load_lines_batch(
    pool: &SqlitePool,
    entry_ids: &[String],
) -> Result<HashMap<String, Vec<JournalLine>>, AppError> {
    if entry_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let mut result = HashMap::new();

    for chunk in entry_ids.chunks(LINES_BATCH_SIZE) {
        let placeholders: Vec<String> = chunk.iter().map(|_| "?".to_string()).collect();
        let sql = format!(
            "SELECT id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description FROM journal_lines WHERE journal_entry_id IN ({})",
            placeholders.join(",")
        );

        let mut query = sqlx::query_as::<_, JournalLineRow>(&sql);
        for id in chunk {
            query = query.bind(id);
        }

        let rows = query
            .fetch_all(pool)
            .await
            .map_err(|e| AppError::Infrastructure(e.to_string()))?;

        for row in rows {
            let journal_entry_id = row.journal_entry_id.clone();
            result
                .entry(journal_entry_id)
                .or_insert_with(Vec::new)
                 .push(row_to_line(row));
        }
    }

    Ok(result)
}

#[derive(sqlx::FromRow)]
struct AggregationRow {
    account_id: String,
    total_debit_base: String,
    total_credit_base: String,
}

pub async fn aggregate_by_account(
    pool: &SqlitePool,
) -> Result<Vec<AccountAggregationRow>, AppError> {
    let rows = sqlx::query_as::<_, AggregationRow>(
        "SELECT jl.account_id,
                CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT) AS total_debit_base,
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT) AS total_credit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
         GROUP BY jl.account_id",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let account_id = AccountId::from_str(&r.account_id).ok()?;
            let total_debit_base =
                rust_decimal::Decimal::from_str(&r.total_debit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            let total_credit_base =
                rust_decimal::Decimal::from_str(&r.total_credit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            Some(AccountAggregationRow {
                account_id,
                total_debit_base,
                total_credit_base,
            })
        })
        .collect())
}

/// Transaction-aware variant of [`aggregate_by_account`]. Executes against the
/// active transaction so uncommitted writes (e.g. the FiscalClosing entry
/// created earlier in the same fiscal-close transaction) are visible to the
/// carry-forward aggregation.
pub async fn aggregate_by_account_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
) -> Result<Vec<AccountAggregationRow>, AppError> {
    let rows = sqlx::query_as::<_, AggregationRow>(
        "SELECT jl.account_id,
                CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT) AS total_debit_base,
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT) AS total_credit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
         GROUP BY jl.account_id",
    )
    .fetch_all(&mut **tx)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let account_id = AccountId::from_str(&r.account_id).ok()?;
            let total_debit_base =
                rust_decimal::Decimal::from_str(&r.total_debit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            let total_credit_base =
                rust_decimal::Decimal::from_str(&r.total_credit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            Some(AccountAggregationRow {
                account_id,
                total_debit_base,
                total_credit_base,
            })
        })
        .collect())
}

/// Income-Statement aggregation: excludes `FiscalClosing` entries so the
/// Income Statement shows operational revenue/expense activity only. After a
/// fiscal year close, the closing entry zeroes Revenue/Expense — including it
/// would produce $0 IS reports for the closed year.
///
/// NOTE: Trial Balance and Balance Sheet use `aggregate_by_account()` instead,
/// because they need FiscalClosing to maintain balanced debits/credits and
/// correct Retained Earnings.
pub async fn aggregate_by_account_report(
    pool: &SqlitePool,
) -> Result<Vec<AccountAggregationRow>, AppError> {
    let rows = sqlx::query_as::<_, AggregationRow>(
        "SELECT jl.account_id,
                CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT) AS total_debit_base,
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT) AS total_credit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND je.journal_type != 'FiscalClosing'
         GROUP BY jl.account_id",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let account_id = AccountId::from_str(&r.account_id).ok()?;
            let total_debit_base =
                rust_decimal::Decimal::from_str(&r.total_debit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            let total_credit_base =
                rust_decimal::Decimal::from_str(&r.total_credit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            Some(AccountAggregationRow {
                account_id,
                total_debit_base,
                total_credit_base,
            })
        })
        .collect())
}

/// Income-Statement aggregation with date filtering: same as
/// `aggregate_by_account_report` but bounded by a date range.
/// Excludes `FiscalClosing` entries so the Income Statement shows
/// operational revenue/expense activity only.
pub async fn aggregate_by_account_report_for_period(
    pool: &SqlitePool,
    from_date: DateTime<Utc>,
    to_date: DateTime<Utc>,
) -> Result<Vec<AccountAggregationRow>, AppError> {
    let rows = sqlx::query_as::<_, AggregationRow>(
        "SELECT jl.account_id,
                CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT) AS total_debit_base,
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT) AS total_credit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND je.journal_type != 'FiscalClosing'
           AND je.entry_date >= ?
           AND je.entry_date <= ?
         GROUP BY jl.account_id",
    )
    .bind(from_date.to_rfc3339())
    .bind(to_date.to_rfc3339())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let account_id = AccountId::from_str(&r.account_id).ok()?;
            let total_debit_base =
                rust_decimal::Decimal::from_str(&r.total_debit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            let total_credit_base =
                rust_decimal::Decimal::from_str(&r.total_credit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            Some(AccountAggregationRow {
                account_id,
                total_debit_base,
                total_credit_base,
            })
        })
        .collect())
}

pub async fn aggregate_by_account_for_period(
    pool: &SqlitePool,
    from_date: DateTime<Utc>,
    to_date: DateTime<Utc>,
) -> Result<Vec<AccountAggregationRow>, AppError> {
    let rows = sqlx::query_as::<_, AggregationRow>(
        "SELECT jl.account_id,
                CAST(COALESCE(SUM(jl.debit_base), '0') AS TEXT) AS total_debit_base,
                CAST(COALESCE(SUM(jl.credit_base), '0') AS TEXT) AS total_credit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND je.entry_date >= ?
           AND je.entry_date <= ?
         GROUP BY jl.account_id",
    )
    .bind(from_date.to_rfc3339())
    .bind(to_date.to_rfc3339())
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    Ok(rows
        .into_iter()
        .filter_map(|r| {
            let account_id = AccountId::from_str(&r.account_id).ok()?;
            let total_debit_base =
                rust_decimal::Decimal::from_str(&r.total_debit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            let total_credit_base =
                rust_decimal::Decimal::from_str(&r.total_credit_base).unwrap_or(rust_decimal::Decimal::ZERO);
            Some(AccountAggregationRow {
                account_id,
                total_debit_base,
                total_credit_base,
            })
        })
        .collect())
}

/// Retained-earnings balance: credit-normal SUM(credit − debit) over
/// posted, non-reversed journal lines hitting `purpose = 'retained_earnings'`
/// accounts, optionally bounded by `to_date`.
pub async fn retained_earnings_balance(
    pool: &SqlitePool,
    to_date: Option<DateTime<Utc>>,
) -> Result<Decimal, AppError> {
    let mut sql = "SELECT CAST(SUM(CAST(jl.credit_base AS REAL) - CAST(jl.debit_base AS REAL)) AS TEXT) AS balance
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         JOIN accounts a ON jl.account_id = a.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND a.purpose = 'retained_earnings'"
        .to_string();

    if to_date.is_some() {
        sql.push_str(" AND je.entry_date <= ?");
    }

    let mut query = sqlx::query_scalar::<_, Option<String>>(&sql);
    if let Some(date) = to_date {
        query = query.bind(date.to_rfc3339());
    }

    let balance_str = query
        .fetch_one(pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?
        .unwrap_or_else(|| "0".to_string());

    Ok(Decimal::from_str(&balance_str).unwrap_or(Decimal::ZERO))
}

#[derive(sqlx::FromRow)]
struct PurposeAggregationRow {
    purpose: String,
    total_debit_base: String,
    total_credit_base: String,
}

pub async fn aggregate_dashboard_kpis(
    pool: &SqlitePool,
) -> Result<std::collections::HashMap<String, rust_decimal::Decimal>, AppError> {
    let rows = sqlx::query_as::<_, PurposeAggregationRow>(
        "SELECT COALESCE(a.purpose, '') AS purpose,
                SUM(CAST(jl.debit_base AS REAL)) AS total_debit_base,
                SUM(CAST(jl.credit_base AS REAL)) AS total_credit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         JOIN accounts a ON jl.account_id = a.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND a.purpose IS NOT NULL
           AND a.purpose != ''
         GROUP BY a.purpose",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut result = std::collections::HashMap::new();
    for row in rows {
        let debit: rust_decimal::Decimal = row
            .total_debit_base
            .parse()
            .unwrap_or(rust_decimal::Decimal::ZERO);
        let credit: rust_decimal::Decimal = row
            .total_credit_base
            .parse()
            .unwrap_or(rust_decimal::Decimal::ZERO);
        let net = credit - debit;
        result.insert(row.purpose, net);
    }
    Ok(result)
}

#[derive(sqlx::FromRow)]
struct MonthlyAggregationRow {
    year_month: String,
    account_type: String,
    total_debit_base: String,
    total_credit_base: String,
}

pub async fn aggregate_monthly_revenue_expenses(
    pool: &SqlitePool,
    from_date: Option<&str>,
    to_date: Option<&str>,
) -> Result<Vec<application::ports::journal_entry_repository::MonthlyRevenueExpense>, AppError>
{
    let rows = sqlx::query_as::<_, MonthlyAggregationRow>(
        "SELECT SUBSTR(je.entry_date, 1, 7) AS year_month,
                a.account_type,
                SUM(CAST(jl.debit_base AS REAL)) AS total_debit_base,
                SUM(CAST(jl.credit_base AS REAL)) AS total_credit_base
         FROM journal_lines jl
         JOIN journal_entries je ON jl.journal_entry_id = je.id
         JOIN accounts a ON jl.account_id = a.id
         WHERE je.status = 'Posted'
           AND je.reversal_of_entry_id IS NULL
           AND a.account_type IN ('Revenue', 'Expenses')
           AND je.journal_type NOT IN ('CashOpeningBalance', 'AccountOpeningBalance', 'MaterialOpeningBalance')
           AND (je.source_id IS NULL
                OR (je.source_id NOT LIKE 'opening_balance:%'
                    AND je.source_id NOT LIKE 'residual_classification:%'
                    AND je.source_id NOT LIKE 'ob_reversal:%'))
           AND je.entry_date >= COALESCE(?, '0000-01-01')
           AND je.entry_date <= COALESCE(?, '9999-12-31')
         GROUP BY year_month, a.account_type
         ORDER BY year_month ASC",
    )
    .bind(from_date)
    .bind(to_date)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut monthly_map: std::collections::HashMap<
        String,
        (rust_decimal::Decimal, rust_decimal::Decimal),
    > = std::collections::HashMap::new();

    for row in rows {
        let debit: rust_decimal::Decimal = row
            .total_debit_base
            .parse()
            .unwrap_or(rust_decimal::Decimal::ZERO);
        let credit: rust_decimal::Decimal = row
            .total_credit_base
            .parse()
            .unwrap_or(rust_decimal::Decimal::ZERO);

        let entry = monthly_map
            .entry(row.year_month)
            .or_insert((rust_decimal::Decimal::ZERO, rust_decimal::Decimal::ZERO));

        if row.account_type == "Revenue" {
            entry.0 += credit - debit;
        } else if row.account_type == "Expenses" {
            entry.1 += debit - credit;
        }
    }

    let mut result: Vec<_> = monthly_map
        .into_iter()
        .map(
            |(year_month, (revenue, expenses))| {
                application::ports::journal_entry_repository::MonthlyRevenueExpense {
                    year_month,
                    revenue,
                    expenses: expenses.abs(),
                }
            },
        )
        .collect();
    result.sort_by(|a, b| a.year_month.cmp(&b.year_month));
    Ok(result)
}

pub async fn count_posted_entries(pool: &SqlitePool) -> Result<i64, AppError> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM journal_entries WHERE status = 'Posted' AND reversal_of_entry_id IS NULL",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(row.0)
}

