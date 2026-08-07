use sqlx::SqlitePool;
use application::errors::AppError;
use domain::accounting::OpeningBalanceMigration;
use super::models::{MigrationRow, MigrationLineRow};
use super::mappers::{row_to_migration, row_to_line};

pub async fn create(pool: &SqlitePool, m: &OpeningBalanceMigration) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(|e| AppError::Infrastructure(e.to_string()))?;

    sqlx::query(
        "INSERT INTO opening_balance_migrations (id, cutover_date, status, notes, posted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&m.id)
    .bind(m.cutover_date.to_rfc3339())
    .bind(m.status.as_str())
    .bind(&m.notes)
    .bind(m.posted_at.map(|d| d.to_rfc3339()))
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
        "UPDATE opening_balance_migrations SET cutover_date = ?, status = ?, notes = ?, posted_at = ?, updated_at = ? WHERE id = ?"
    )
    .bind(m.cutover_date.to_rfc3339())
    .bind(m.status.as_str())
    .bind(&m.notes)
    .bind(m.posted_at.as_ref().map(|d| d.to_rfc3339()))
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
    let row = sqlx::query_as::<_, MigrationRow>(
        "SELECT id, cutover_date, status, notes, posted_at, created_at, updated_at FROM opening_balance_migrations WHERE id = ?"
    )
    .bind(id).fetch_optional(pool).await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let Some(row) = row else { return Ok(None) };

    let lines = sqlx::query_as::<_, MigrationLineRow>(
        "SELECT id, migration_id, account_id, amount, description FROM opening_balance_lines WHERE migration_id = ? ORDER BY created_at"
    )
    .bind(&row.id).fetch_all(pool).await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let parsed = lines.into_iter().map(row_to_line).collect::<Result<Vec<_>, _>>()?;
    Ok(Some(row_to_migration(row, parsed)?))
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<OpeningBalanceMigration>, AppError> {
    let rows = sqlx::query_as::<_, MigrationRow>(
        "SELECT id, cutover_date, status, notes, posted_at, created_at, updated_at FROM opening_balance_migrations ORDER BY created_at DESC"
    )
    .fetch_all(pool).await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let lines = sqlx::query_as::<_, MigrationLineRow>(
            "SELECT id, migration_id, account_id, amount, description FROM opening_balance_lines WHERE migration_id = ? ORDER BY created_at"
        )
        .bind(&row.id).fetch_all(pool).await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        let parsed = lines.into_iter().map(row_to_line).collect::<Result<Vec<_>, _>>()?;
        out.push(row_to_migration(row, parsed)?);
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