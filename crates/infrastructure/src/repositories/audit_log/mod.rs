use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::audit_log_repository::AuditLogRepository;
use domain::audit::AuditLog;
use domain::shared::ids::{AuditLogId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteAuditLogRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteAuditLogRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AuditLogRepository for SqliteAuditLogRepository {
    async fn save(&self, log: &AuditLog) -> Result<(), AppError> {
        commands::save(&self.pool, log).await
    }

    async fn find_by_id(&self, id: &AuditLogId) -> Result<Option<AuditLog>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn list_all(&self, limit: Option<u32>) -> Result<Vec<AuditLog>, AppError> {
        queries::list_all(&self.pool, limit).await
    }

    async fn list_by_entity(&self, entity_type: &str, entity_id: &str) -> Result<Vec<AuditLog>, AppError> {
        queries::list_by_entity(&self.pool, entity_type, entity_id).await
    }
}
