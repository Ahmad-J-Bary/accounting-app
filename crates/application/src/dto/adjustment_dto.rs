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
    pub unit_cost: String,
    pub unit_cost_base: String,
    pub total_cost: String,
    pub total_cost_base: String,
    pub currency_code: Option<String>,
    pub fx_rate: Option<String>,
    pub notes: Option<String>,
    pub reference: Option<String>,
    pub adjustment_date: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStockAdjustmentRequest {
    pub material_id: String,
    pub actual_quantity: f64,
    pub unit_cost: f64,
    pub currency_code: Option<String>,
    pub fx_rate: Option<f64>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub adjustment_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStockAdjustmentRequest {
    pub id: String,
    pub material_id: String,
    pub actual_quantity: f64,
    pub unit_cost: f64,
    pub currency_code: Option<String>,
    pub fx_rate: Option<f64>,
    pub reason: Option<String>,
    pub notes: Option<String>,
    pub adjustment_date: String,
}
