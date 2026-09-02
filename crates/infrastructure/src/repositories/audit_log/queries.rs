use super::mappers::row_to_log;
use super::models::AuditLogRow;
use application::errors::AppError;
use domain::audit::AuditLog;
use domain::shared::ids::AuditLogId;
use sqlx::SqlitePool;

pub async fn find_by_id(pool: &SqlitePool, id: &AuditLogId) -> Result<Option<AuditLog>, AppError> {
    let row = sqlx::query_as::<_, AuditLogRow>(
        "SELECT id, user_id, username, action, entity_type, entity_id, changes, ip_address, created_at
         FROM audit_logs WHERE id = ?"
    )
    .bind(id.to_string())
    .fetch_optional(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    row.map(row_to_log).transpose()
}

pub async fn list_all(pool: &SqlitePool, limit: Option<u32>) -> Result<Vec<AuditLog>, AppError> {
    let limit = limit.unwrap_or(500) as i64;
    let rows = sqlx::query_as::<_, AuditLogRow>(
        "SELECT id, user_id, username, action, entity_type, entity_id, changes, ip_address, created_at
         FROM audit_logs ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_log).collect()
}

pub async fn list_by_entity(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
) -> Result<Vec<AuditLog>, AppError> {
    let rows = sqlx::query_as::<_, AuditLogRow>(
        "SELECT id, user_id, username, action, entity_type, entity_id, changes, ip_address, created_at
         FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC"
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    rows.into_iter().map(row_to_log).collect()
}
