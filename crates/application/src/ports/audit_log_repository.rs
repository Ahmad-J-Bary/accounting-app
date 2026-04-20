use async_trait::async_trait;
use domain::audit::AuditLog;
use domain::shared::ids::AuditLogId;
use crate::errors::AppError;

#[async_trait]
pub trait AuditLogRepository: Send + Sync {
    async fn save(&self, log: &AuditLog) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &AuditLogId) -> Result<Option<AuditLog>, AppError>;
    async fn list_all(&self, limit: Option<u32>) -> Result<Vec<AuditLog>, AppError>;
    async fn list_by_entity(&self, entity_type: &str, entity_id: &str) -> Result<Vec<AuditLog>, AppError>;
}
