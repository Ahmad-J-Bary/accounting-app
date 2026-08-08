#[derive(sqlx::FromRow)]
pub struct MigrationRow {
    pub id: String,
    pub company_id: Option<String>,
    pub cutover_date: String,
    pub source_system: Option<String>,
    pub source_reference: Option<String>,
    pub residual_classification: Option<String>,
    pub residual_account_id: Option<String>,
    pub residual_applied_at: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub validated_by: Option<String>,
    pub validated_at: Option<String>,
    pub approved_by: Option<String>,
    pub approved_at: Option<String>,
    pub posted_at: Option<String>,
    pub locked_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct MigrationLineRow {
    pub id: String,
    pub migration_id: String,
    pub account_id: String,
    pub amount: String,
    pub description: Option<String>,
}