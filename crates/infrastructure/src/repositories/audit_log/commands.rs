use application::errors::AppError;
use domain::audit::AuditLog;
use sqlx::SqlitePool;

pub async fn save(pool: &SqlitePool, log: &AuditLog) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO audit_logs (id, user_id, username, action, entity_type, entity_id, changes, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(log.id.to_string())
    .bind(log.user_id.as_ref().map(|id| id.to_string()))
    .bind(&log.username)
    .bind(&log.action)
    .bind(&log.entity_type)
    .bind(&log.entity_id)
    .bind(&log.changes)
    .bind(&log.ip_address)
    .bind(log.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(|e| AppError::Infrastructure(e.to_string()))?;
    Ok(())
}
