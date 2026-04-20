use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionMaterialDto {
    pub id: String,
    pub product_id: String,
    pub product_name: Option<String>,
    pub quantity_required: String,
    pub quantity_consumed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionOutputDto {
    pub id: String,
    pub product_id: String,
    pub product_name: Option<String>,
    pub quantity_produced: String,
    pub unit_cost: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductionOrderDto {
    pub id: String,
    pub order_number: String,
    pub materials: Vec<ProductionMaterialDto>,
    pub outputs: Vec<ProductionOutputDto>,
    pub status: String,
    pub production_date: String,
    pub notes: Option<String>,
    pub total_cost: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProductionMaterialRequest {
    pub product_id: String,
    pub quantity_required: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProductionOutputRequest {
    pub product_id: String,
    pub quantity_produced: f64,
    pub unit_cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProductionOrderRequest {
    pub order_number: String,
    pub materials: Vec<CreateProductionMaterialRequest>,
    pub outputs: Vec<CreateProductionOutputRequest>,
    pub production_date: String,
    pub notes: Option<String>,
}
