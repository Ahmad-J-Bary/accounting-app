#[derive(sqlx::FromRow)]
pub struct WarehouseRow {
    pub id: String,
    pub name: String,
    pub code: Option<String>,
    pub address: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}
