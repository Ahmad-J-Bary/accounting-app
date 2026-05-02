#![allow(dead_code)]
#[derive(sqlx::FromRow)]
#[allow(dead_code)]
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

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct MaterialUnitRow {
    pub id: String,
    pub material_id: String,
    pub name: String,
    pub conversion_factor: String,
    pub barcode: Option<String>,
    pub is_base: bool,
    pub created_at: String,
    pub updated_at: String,
}
