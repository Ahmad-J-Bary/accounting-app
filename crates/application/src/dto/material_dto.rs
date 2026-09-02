use domain::inventory::material::{
    Material, MaterialPurchasePrice, MaterialSalePrice, MaterialUnit,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialUnitDto {
    pub id: String,
    pub material_id: String,
    pub name: String,
    pub conversion_factor: String,
    pub barcode: Option<String>,
    pub is_base: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialPurchasePriceDto {
    pub id: String,
    pub unit_id: String,
    pub price: String,
    pub price_base: String,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialSalePriceDto {
    pub id: String,
    pub unit_id: String,
    pub tier: String,
    pub price: String,
    pub price_base: String,
    pub min_price: String,
    pub min_price_base: String,
    pub max_quantity: String,
    pub max_quantity_unit_id: Option<String>,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialDto {
    pub id: String,
    pub name: String,
    pub name_en: String,
    pub barcode: String,
    pub code: String,
    pub category_ids: Vec<String>,
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
    pub purchase_prices: Vec<MaterialPurchasePriceDto>,
    pub sale_prices: Vec<MaterialSalePriceDto>,
    // Summary Fields
    pub total_received: String,
    pub total_sold: String,
    pub total_available: String,
    pub total_damaged: String,
    pub last_purchase_price: String,
    pub last_purchase_price_base: String,
    pub last_purchase_price_original: String,
    pub last_sale_price: String,
    pub last_sale_price_base: String,
    pub last_sale_price_original: String,
    pub average_cost: String,
    pub average_cost_base: String,
    pub average_raw_price_base: String,
    pub costing_method: String,
    pub active_lots_count: i64,
    pub units: Vec<MaterialUnitDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialUnitRequest {
    pub name: String,
    pub conversion_factor: String,
    pub barcode: Option<String>,
}

impl From<MaterialUnit> for MaterialUnitDto {
    fn from(u: MaterialUnit) -> Self {
        Self {
            id: u.id.0.to_string(),
            material_id: u.material_id.0.to_string(),
            name: u.name,
            conversion_factor: u.conversion_factor.to_string(),
            barcode: u.barcode,
            is_base: u.is_base,
        }
    }
}

impl From<MaterialPurchasePrice> for MaterialPurchasePriceDto {
    fn from(p: MaterialPurchasePrice) -> Self {
        Self {
            id: p.id,
            unit_id: p.unit_id.0.to_string(),
            price: p.price.to_string(),
            price_base: p.price_base.to_string(),
            currency: p.currency,
        }
    }
}

impl From<MaterialSalePrice> for MaterialSalePriceDto {
    fn from(p: MaterialSalePrice) -> Self {
        Self {
            id: p.id,
            unit_id: p.unit_id.0.to_string(),
            tier: p.tier,
            price: p.price.to_string(),
            price_base: p.price_base.to_string(),
            min_price: p.min_price.to_string(),
            min_price_base: p.min_price_base.to_string(),
            max_quantity: p.max_quantity,
            max_quantity_unit_id: p.max_quantity_unit_id,
            currency: p.currency,
        }
    }
}

impl From<Material> for MaterialDto {
    fn from(material: Material) -> Self {
        Self {
            id: material.id.0.to_string(),
            name: material.name,
            name_en: material.name_en,
            barcode: material.barcode,
            code: material.code,
            category_ids: material
                .category_ids
                .iter()
                .map(|id| id.0.to_string())
                .collect(),
            minimum_stock: material.minimum_stock.to_string(),
            notes: material.notes,
            image_path: material.image_path,
            default_purchase_unit_id: material.default_purchase_unit_id.map(|id| id.0.to_string()),
            default_sale_unit_id: material.default_sale_unit_id.map(|id| id.0.to_string()),
            default_purchase_currency: material.default_purchase_currency,
            default_sale_currency: material.default_sale_currency,
            default_warehouse_id: material.default_warehouse_id,
            has_expiry: material.has_expiry,
            expiry_alert_before_days: material.expiry_alert_before_days,
            purchase_prices: material
                .purchase_prices
                .into_iter()
                .map(MaterialPurchasePriceDto::from)
                .collect(),
            sale_prices: material
                .sale_prices
                .into_iter()
                .map(MaterialSalePriceDto::from)
                .collect(),
            total_received: "0".to_string(),
            total_sold: "0".to_string(),
            total_available: "0".to_string(),
            total_damaged: "0".to_string(),
            last_purchase_price: "0".to_string(),
            last_purchase_price_base: "0".to_string(),
            last_purchase_price_original: "0".to_string(),
            last_sale_price: "0".to_string(),
            last_sale_price_base: "0".to_string(),
            last_sale_price_original: "0".to_string(),
            average_cost: "0".to_string(),
            average_cost_base: "0".to_string(),
            average_raw_price_base: "0".to_string(),
            costing_method: "Average".to_string(),
            active_lots_count: 0,
            units: material
                .units
                .into_iter()
                .map(MaterialUnitDto::from)
                .collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialRequest {
    pub name: String,
    pub name_en: Option<String>,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub minimum_stock: String,
    pub units: Vec<CreateMaterialUnitRequest>,
    pub category_ids: Vec<String>,
    pub notes: Option<String>,
    pub image_path: Option<String>,
    pub default_purchase_unit_id: Option<String>,
    pub default_sale_unit_id: Option<String>,
    pub default_purchase_currency: Option<String>,
    pub default_sale_currency: Option<String>,
    pub default_warehouse_id: Option<String>,
    pub has_expiry: Option<bool>,
    pub expiry_alert_before_days: Option<i32>,
    pub purchase_prices: Vec<CreateMaterialPriceRequest>,
    pub sale_prices: Vec<CreateMaterialSalePriceRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMaterialRequest {
    pub id: String,
    pub name: String,
    pub name_en: String,
    pub barcode: String,
    pub code: String,
    pub minimum_stock: String,
    pub category_ids: Vec<String>,
    pub notes: Option<String>,
    pub image_path: Option<String>,
    pub default_purchase_unit_id: Option<String>,
    pub default_sale_unit_id: Option<String>,
    pub default_purchase_currency: Option<String>,
    pub default_sale_currency: Option<String>,
    pub default_warehouse_id: Option<String>,
    pub has_expiry: Option<bool>,
    pub expiry_alert_before_days: Option<i32>,
    pub purchase_prices: Vec<CreateMaterialPriceRequest>,
    pub sale_prices: Vec<CreateMaterialSalePriceRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialPriceRequest {
    pub unit_id: String,
    pub price: String,
    pub price_base: String,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialSalePriceRequest {
    pub unit_id: String,
    pub tier: String,
    pub price: String,
    pub price_base: String,
    pub min_price: String,
    pub min_price_base: String,
    pub max_quantity: String,
    pub max_quantity_unit_id: Option<String>,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddMaterialUnitRequest {
    pub material_id: String,
    pub name: String,
    pub conversion_factor: String,
    pub barcode: Option<String>,
}
