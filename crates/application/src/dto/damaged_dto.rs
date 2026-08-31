use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamagedItemDto {
    pub id: String,
    pub material_id: String,
    pub material_name: Option<String>,
    pub quantity: String,
    pub reason: Option<String>,
    pub damage_date: String,
    pub cost_impact: String,
    pub cost_impact_base: Option<String>,
    pub currency_code: Option<String>,
    pub fx_rate: Option<String>,
    pub notes: Option<String>,
    pub reference: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDamagedItemRequest {
    pub material_id: String,
    pub quantity: f64,
    pub reason: Option<String>,
    pub damage_date: String,
    pub cost_impact: f64,
    pub currency_code: Option<String>,
    pub fx_rate: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDamagedItemRequest {
    pub id: String,
    pub material_id: String,
    pub quantity: f64,
    pub reason: Option<String>,
    pub damage_date: String,
    pub cost_impact: f64,
    pub currency_code: Option<String>,
    pub fx_rate: Option<f64>,
    pub notes: Option<String>,
}
