use domain::inventory::material::{Material, MaterialUnit};
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
pub struct MaterialDto {
    pub id: String,
    pub name: String,
    pub barcode: String,
    pub code: String,
    pub stock_quantity: String,
    pub minimum_stock: String,
    pub purchase_price: String,
    pub is_active: bool,
    pub units: Vec<MaterialUnitDto>,
    pub category_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialUnitRequest {
    pub name: String,
    pub conversion_factor: String,
    pub barcode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaterialRequest {
    pub name: String,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub minimum_stock: String,
    pub units: Vec<CreateMaterialUnitRequest>,
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

impl From<Material> for MaterialDto {
    fn from(material: Material) -> Self {
        Self {
            id: material.id.0.to_string(),
            name: material.name,
            barcode: material.barcode,
            code: material.code,
            stock_quantity: "0".to_string(),
            minimum_stock: material.minimum_stock.to_string(),
            purchase_price: "0".to_string(),
            is_active: material.is_active,
            units: material.units.into_iter().map(MaterialUnitDto::from).collect(),
            category_ids: material.category_ids.iter().map(|id| id.0.to_string()).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddMaterialUnitRequest {
    pub material_id: String,
    pub name: String,
    pub conversion_factor: String,
    pub barcode: Option<String>,
}
