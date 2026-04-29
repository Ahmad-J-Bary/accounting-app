#[derive(sqlx::FromRow)]
pub struct CategoryRow {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub is_active: bool,
    pub is_hybrid: Option<bool>,
    pub code_prefix: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
