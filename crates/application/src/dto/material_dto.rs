use domain::inventory::material::Material;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialDto {
    pub id: String,
    pub name: String,
    pub barcode: String,
    pub code: String,
    pub purchase_price: Option<String>,
    pub retail_price: Option<String>,
    pub wholesale_price: Option<String>,
    pub semi_wholesale_price: Option<String>,
    pub stock_quantity: String,
    pub minimum_stock: String,
    pub is_active: bool,
    pub notes: Option<String>,
    pub category_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialRequest {
    pub name: String,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub purchase_price: Option<String>,
    pub retail_price: Option<String>,
    pub wholesale_price: Option<String>,
    pub semi_wholesale_price: Option<String>,
    pub minimum_stock: String,
    pub notes: Option<String>,
    pub category_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMaterialRequest {
    pub id: String,
    pub name: String,
    pub barcode: String,
    pub code: String,
    pub purchase_price: Option<String>,
    pub retail_price: Option<String>,
    pub wholesale_price: Option<String>,
    pub semi_wholesale_price: Option<String>,
    pub minimum_stock: String,
    pub is_active: bool,
    pub notes: Option<String>,
    pub category_ids: Vec<String>,
}

impl From<Material> for MaterialDto {
    fn from(material: Material) -> Self {
        Self {
            id: material.id.0.to_string(),
            name: material.name,
            barcode: material.barcode,
            code: material.code,
            purchase_price: material.purchase_price.map(|m| m.amount().to_string()),
            retail_price: material.retail_price.map(|m| m.amount().to_string()),
            wholesale_price: material.wholesale_price.map(|m| m.amount().to_string()),
            semi_wholesale_price: material.semi_wholesale_price.map(|m| m.amount().to_string()),
            stock_quantity: "0".to_string(), // This will be filled by the UseCase/Service layer
            minimum_stock: material.minimum_stock.to_string(),
            is_active: material.is_active,
            notes: material.notes,
            category_ids: material.category_ids.iter().map(|id| id.0.to_string()).collect(),
        }
    }
}
