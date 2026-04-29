#[derive(sqlx::FromRow)]
pub struct AuditLogRow {
    pub id: String,
    pub user_id: Option<String>,
    pub username: String,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub changes: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: String,
}
