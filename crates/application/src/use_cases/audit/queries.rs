use crate::dto::audit_dto::AuditLogDto;
use crate::errors::AppError;
use crate::ports::audit_log_repository::AuditLogRepository;
use std::sync::Arc;

pub struct AuditQueries {
    repo: Arc<dyn AuditLogRepository>,
}

impl AuditQueries {
    pub fn new(repo: Arc<dyn AuditLogRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_all(&self, limit: Option<u32>) -> Result<Vec<AuditLogDto>, AppError> {
        Ok(self
            .repo
            .list_all(limit)
            .await?
            .into_iter()
            .map(to_dto)
            .collect())
    }
}

fn to_dto(log: domain::audit::AuditLog) -> AuditLogDto {
    AuditLogDto {
        id: log.id.to_string(),
        user_id: log.user_id.map(|id| id.to_string()),
        username: log.username,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        changes: log.changes,
        ip_address: log.ip_address,
        created_at: log.created_at.to_rfc3339(),
    }
}
