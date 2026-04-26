use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockAdjustmentDto {
    pub id: String,
    pub material_id: String,
    pub material_name: Option<String>,
    pub system_quantity: String,
    pub actual_quantity: String,
    pub difference: String,
    pub reason: Option<String>,
    pub adjustment_date: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStockAdjustmentRequest {
    pub material_id: String,
    pub actual_quantity: f64,
    pub reason: Option<String>,
    pub adjustment_date: String,
}
