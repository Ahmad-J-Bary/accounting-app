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
    pub notes: Option<String>,
    pub image_path: Option<String>,
    pub default_purchase_unit_id: Option<String>,
    pub default_sale_unit_id: Option<String>,
    pub default_purchase_currency: Option<String>,
    pub default_sale_currency: Option<String>,
    pub default_warehouse_id: Option<String>,
    pub has_expiry: bool,
    pub expiry_alert_before_days: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct MaterialPurchasePriceRow {
    pub id: String,
    pub material_id: String,
    pub unit_id: String,
    pub price: f64,
    pub price_base: f64,
    pub currency: String,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct MaterialSalePriceRow {
    pub id: String,
    pub material_id: String,
    pub unit_id: String,
    pub tier: String,
    pub price: f64,
    pub price_base: f64,
    pub min_price: f64,
    pub min_price_base: f64,
    pub max_quantity: String,
    pub max_quantity_unit_id: Option<String>,
    pub currency: String,
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
