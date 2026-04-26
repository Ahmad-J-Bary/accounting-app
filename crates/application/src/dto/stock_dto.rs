use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovementDto {
    pub id: String,
    pub material_id: String,
    pub material_name: Option<String>,
    pub quantity: String,
    pub movement_type: String,
    pub reason: Option<String>,
    pub reference: Option<String>,
    pub movement_date: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordStockMovementRequest {
    pub material_id: String,
    pub quantity: f64,
    pub movement_type: String,
    pub reason: Option<String>,
    pub reference: Option<String>,
    pub movement_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockBalanceDto {
    pub material_id: String,
    pub material_name: String,
    pub material_code: String,
    pub current_balance: String,
    pub minimum_stock: String,
    pub is_low_stock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpeningStockItem {
    pub material_id: String,
    pub quantity: String,
    pub unit_cost: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordOpeningStockRequest {
    pub items: Vec<OpeningStockItem>,
    pub date: String,
    pub notes: Option<String>,
}
