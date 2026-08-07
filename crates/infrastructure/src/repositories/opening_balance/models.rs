#[derive(sqlx::FromRow)]
pub struct MigrationRow {
    pub id: String,
    pub cutover_date: String,
    pub status: String,
    pub notes: Option<String>,
    pub posted_at: Option<String>,
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