use domain::inventory::material::Material;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialDto {
    pub id: String,
    pub name: String,
    pub barcode: String,
    pub code: String,
    pub stock_quantity: String,
    pub minimum_stock: String,
    pub purchase_price: String,
    pub is_active: bool,
    pub category_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialRequest {
    pub name: String,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub minimum_stock: String,
    pub category_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMaterialRequest {
    pub id: String,
    pub name: String,
    pub barcode: String,
    pub code: String,
    pub minimum_stock: String,
    pub is_active: bool,
    pub category_ids: Vec<String>,
}

impl From<Material> for MaterialDto {
    fn from(material: Material) -> Self {
        Self {
            id: material.id.0.to_string(),
            name: material.name,
            barcode: material.barcode,
            code: material.code,
            stock_quantity: "0".to_string(), // This will be filled by the UseCase layer
            minimum_stock: material.minimum_stock.to_string(),
            purchase_price: "0".to_string(), // This will be filled by the UseCase layer
            is_active: material.is_active,
            category_ids: material.category_ids.iter().map(|id| id.0.to_string()).collect(),
        }
    }
}
