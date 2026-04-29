#[derive(sqlx::FromRow)]
pub struct MaterialRow {
    pub id: String,
    pub name: String,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub minimum_stock: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}
