use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarehouseDto {
    pub id: String,
    pub name: String,
    pub code: Option<String>,
    pub address: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWarehouseRequest {
    pub name: String,
    pub code: Option<String>,
    pub address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWarehouseRequest {
    pub id: String,
    pub name: String,
    pub code: Option<String>,
    pub address: Option<String>,
    pub is_active: bool,
    pub is_default: bool,
}
