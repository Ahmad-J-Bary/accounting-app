use crate::shared::ids::{AuditLogId, UserId};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: AuditLogId,
    pub user_id: Option<UserId>,
    pub username: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub changes: Option<String>, // JSON string of before/after
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl AuditLog {
    pub fn new(
        user_id: Option<UserId>,
        username: String,
        action: String,
        entity_type: String,
        entity_id: Option<String>,
        changes: Option<String>,
    ) -> Self {
        Self {
            id: AuditLogId(Uuid::new_v4()),
            user_id,
            username,
            action,
            entity_type,
            entity_id,
            changes,
            ip_address: None,
            created_at: Utc::now(),
        }
    }

    pub fn system(action: String, entity_type: String, entity_id: Option<String>) -> Self {
        Self::new(
            None,
            "النظام".into(),
            action,
            entity_type,
            entity_id,
            None,
        )
    }
}
