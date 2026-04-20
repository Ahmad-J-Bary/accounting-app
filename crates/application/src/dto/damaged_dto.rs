use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DamagedItemDto {
    pub id: String,
    pub product_id: String,
    pub product_name: Option<String>,
    pub quantity: String,
    pub reason: String,
    pub damage_date: String,
    pub cost_impact: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDamagedItemRequest {
    pub product_id: String,
    pub quantity: f64,
    pub reason: String,
    pub damage_date: String,
    pub cost_impact: f64,
    pub notes: Option<String>,
}
