use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::OpeningBalanceMigration;
use super::models::{MigrationRow, MigrationLineRow};
use super::mappers::{row_to_migration, row_to_line};

const MIGRATION_COLUMNS: &str = "id, company_id, cutover_date, source_system, source_reference, residual_classification, residual_account_id, residual_applied_at, status, notes, validated_by, validated_at, approved_by, approved_at, posted_at, locked_at, created_at, updated_at";

pub async fn create(pool: &SqlitePool, m: &OpeningBalanceMigration) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query(
        "INSERT INTO opening_balance_migrations (id, company_id, cutover_date, source_system, source_reference, residual_classification, residual_account_id, residual_applied_at, status, notes, validated_by, validated_at, approved_by, approved_at, posted_at, locked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&m.id)
    .bind(&m.company_id)
    .bind(m.cutover_date.to_rfc3339())
    .bind(&m.source_system)
    .bind(&m.source_reference)
    .bind(m.residual_classification.map(|c| c.as_str()))
    .bind(m.residual_account_id.map(|id| id.to_string()))
    .bind(m.residual_applied_at.map(|d| d.to_rfc3339()))
    .bind(m.status.as_str())
    .bind(&m.notes)
    .bind(&m.validated_by)
    .bind(m.validated_at.map(|d| d.to_rfc3339()))
    .bind(&m.approved_by)
    .bind(m.approved_at.map(|d| d.to_rfc3339()))
    .bind(m.posted_at.map(|d| d.to_rfc3339()))
    .bind(m.locked_at.map(|d| d.to_rfc3339()))
    .bind(m.created_at.to_rfc3339())
    .bind(m.updated_at.to_rfc3339())
    .execute(&mut *tx).await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    insert_lines(&mut tx, &m.id, &m.lines).await?;

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))
}

pub async fn update(pool: &SqlitePool, m: &OpeningBalanceMigration) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query(
        "UPDATE opening_balance_migrations SET cutover_date = ?, source_system = ?, source_reference = ?, residual_classification = ?, residual_account_id = ?, residual_applied_at = ?, status = ?, notes = ?, validated_by = ?, validated_at = ?, approved_by = ?, approved_at = ?, posted_at = ?, locked_at = ?, updated_at = ? WHERE id = ?"
    )
    .bind(m.cutover_date.to_rfc3339())
    .bind(&m.source_system)
    .bind(&m.source_reference)
    .bind(m.residual_classification.map(|c| c.as_str()))
    .bind(m.residual_account_id.map(|id| id.to_string()))
    .bind(m.residual_applied_at.map(|d| d.to_rfc3339()))
    .bind(m.status.as_str())
    .bind(&m.notes)
    .bind(&m.validated_by)
    .bind(m.validated_at.map(|d| d.to_rfc3339()))
    .bind(&m.approved_by)
    .bind(m.approved_at.map(|d| d.to_rfc3339()))
    .bind(m.posted_at.as_ref().map(|d| d.to_rfc3339()))
    .bind(m.locked_at.map(|d| d.to_rfc3339()))
    .bind(m.updated_at.to_rfc3339())
    .bind(&m.id)
    .execute(&mut *tx).await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query("DELETE FROM opening_balance_lines WHERE migration_id = ?")
        .bind(&m.id).execute(&mut *tx).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    insert_lines(&mut tx, &m.id, &m.lines).await?;

    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))
}

async fn insert_lines<'a>(
    tx: &mut sqlx::Transaction<'a, sqlx::Sqlite>,
    migration_id: &str,
    lines: &[domain::accounting::OpeningBalanceLine],
) -> Result<(), AppError> {
    for line in lines {
        sqlx::query(
            "INSERT INTO opening_balance_lines (id, migration_id, account_id, amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(migration_id)
        .bind(line.account_id.to_string())
        .bind(line.amount.to_string())
        .bind(&line.description)
        .bind(chrono::Utc::now().to_rfc3339())
        .execute(&mut **tx).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    }
    Ok(())
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<OpeningBalanceMigration>, AppError> {
    let sql = format!("SELECT {MIGRATION_COLUMNS} FROM opening_balance_migrations WHERE id = ?");
    let row = sqlx::query_as::<_, MigrationRow>(&sql)
        .bind(id).fetch_optional(pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let Some(row) = row else { return Ok(None) };

    let lines = load_lines(pool, &row.id).await?;
    Ok(Some(row_to_migration(row, lines)?))
}

pub async fn find_by_cutover_date(pool: &SqlitePool, cutover_date: &str) -> Result<Vec<OpeningBalanceMigration>, AppError> {
    let sql = format!("SELECT {MIGRATION_COLUMNS} FROM opening_balance_migrations WHERE date(cutover_date) = date(?) ORDER BY created_at DESC");
    let rows = sqlx::query_as::<_, MigrationRow>(&sql)
        .bind(cutover_date).fetch_all(pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let lines = load_lines(pool, &row.id).await?;
        out.push(row_to_migration(row, lines)?);
    }
    Ok(out)
}

async fn load_lines(pool: &SqlitePool, migration_id: &str) -> Result<Vec<domain::accounting::OpeningBalanceLine>, AppError> {
    let line_rows = sqlx::query_as::<_, MigrationLineRow>(
        "SELECT id, migration_id, account_id, amount, description FROM opening_balance_lines WHERE migration_id = ? ORDER BY created_at"
    )
    .bind(migration_id).fetch_all(pool).await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    line_rows.into_iter().map(row_to_line).collect()
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<OpeningBalanceMigration>, AppError> {
    let sql = format!("SELECT {MIGRATION_COLUMNS} FROM opening_balance_migrations ORDER BY created_at DESC");
    let rows = sqlx::query_as::<_, MigrationRow>(&sql)
        .fetch_all(pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let lines = load_lines(pool, &row.id).await?;
        out.push(row_to_migration(row, lines)?);
    }
    Ok(out)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;
    sqlx::query("DELETE FROM opening_balance_lines WHERE migration_id = ?")
        .bind(id).execute(&mut *tx).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    sqlx::query("DELETE FROM opening_balance_migrations WHERE id = ?")
        .bind(id).execute(&mut *tx).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    tx.commit().await.map_err(|e| AppError::Infrastructure(e.to_string()))
}