use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::audit_log_repository::AuditLogRepository;
use domain::audit::AuditLog;
use domain::shared::ids::{AuditLogId, UserId};
use uuid::Uuid;
use chrono::DateTime;

pub struct SqliteAuditLogRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteAuditLogRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct AuditLogRow {
    id: String,
    user_id: Option<String>,
    username: String,
    action: String,
    entity_type: String,
    entity_id: Option<String>,
    changes: Option<String>,
    ip_address: Option<String>,
    created_at: String,
}

fn row_to_log(row: AuditLogRow) -> Result<AuditLog, AppError> {
    Ok(AuditLog {
        id: AuditLogId(Uuid::parse_str(&row.id).map_err(|e| AppError::Infrastructure(e.to_string()))?),
        user_id: row.user_id.map(|id| UserId(Uuid::parse_str(&id).unwrap())),
        username: row.username,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        changes: row.changes,
        ip_address: row.ip_address,
        created_at: DateTime::parse_from_rfc3339(&row.created_at).map(|d| d.with_timezone(&chrono::Utc)).unwrap_or_else(|_| chrono::Utc::now()),
    })
}

#[async_trait]
impl AuditLogRepository for SqliteAuditLogRepository {
    async fn save(&self, log: &AuditLog) -> Result<(), AppError> {
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
        .execute(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        Ok(())
    }

    async fn find_by_id(&self, id: &AuditLogId) -> Result<Option<AuditLog>, AppError> {
        let row = sqlx::query_as::<_, AuditLogRow>(
            "SELECT id, user_id, username, action, entity_type, entity_id, changes, ip_address, created_at
             FROM audit_logs WHERE id = ?"
        )
        .bind(id.to_string())
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        row.map(row_to_log).transpose()
    }

    async fn list_all(&self, limit: Option<u32>) -> Result<Vec<AuditLog>, AppError> {
        let limit = limit.unwrap_or(500) as i64;
        let rows = sqlx::query_as::<_, AuditLogRow>(
            "SELECT id, user_id, username, action, entity_type, entity_id, changes, ip_address, created_at
             FROM audit_logs ORDER BY created_at DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        rows.into_iter().map(row_to_log).collect()
    }

    async fn list_by_entity(&self, entity_type: &str, entity_id: &str) -> Result<Vec<AuditLog>, AppError> {
        let rows = sqlx::query_as::<_, AuditLogRow>(
            "SELECT id, user_id, username, action, entity_type, entity_id, changes, ip_address, created_at
             FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC"
        )
        .bind(entity_type)
        .bind(entity_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AppError::Infrastructure(e.to_string()))?;
        rows.into_iter().map(row_to_log).collect()
    }
}

