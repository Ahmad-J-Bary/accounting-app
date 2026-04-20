use std::sync::Arc;
use crate::ports::audit_log_repository::AuditLogRepository;
use crate::dto::audit_dto::AuditLogDto;
use crate::errors::AppError;

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

pub struct ListAuditLogsUseCase {
    repo: Arc<dyn AuditLogRepository>,
}

impl ListAuditLogsUseCase {
    pub fn new(repo: Arc<dyn AuditLogRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, limit: Option<u32>) -> Result<Vec<AuditLogDto>, AppError> {
        Ok(self.repo.list_all(limit).await?.into_iter().map(to_dto).collect())
    }
}
