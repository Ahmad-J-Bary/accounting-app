#![allow(dead_code)]
#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct MaterialRow {
    pub id: String,
    pub name: String,
    pub name_en: String,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub minimum_stock: String,
    pub is_active: bool,
    pub notes: Option<String>,
    pub image_path: Option<String>,
    pub default_purchase_unit_id: Option<String>,
    pub default_sale_unit_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct MaterialPurchasePriceRow {
    pub id: String,
    pub material_id: String,
    pub unit_id: String,
    pub price_usd: f64,
    pub price_syp: f64,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct MaterialSalePriceRow {
    pub id: String,
    pub material_id: String,
    pub unit_id: String,
    pub tier: String,
    pub price_usd: f64,
    pub price_syp: f64,
    pub min_price_usd: f64,
    pub min_price_syp: f64,
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
