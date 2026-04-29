use application::errors::AppError;
use domain::audit::AuditLog;
use domain::shared::ids::{AuditLogId, UserId};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use super::models::AuditLogRow;

pub fn row_to_log(row: AuditLogRow) -> Result<AuditLog, AppError> {
    Ok(AuditLog {
        id: AuditLogId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        user_id: row.user_id.map(|id| UserId(Uuid::parse_str(&id).unwrap())),
        username: row.username,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        changes: row.changes,
        ip_address: row.ip_address,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
    })
}
