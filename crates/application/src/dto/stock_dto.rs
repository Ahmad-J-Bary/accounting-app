use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovementDto {
    pub id: String,
    pub product_id: String,
    pub product_name: Option<String>,
    pub quantity: String,
    pub movement_type: String,
    pub reason: Option<String>,
    pub reference: Option<String>,
    pub movement_date: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordStockMovementRequest {
    pub product_id: String,
    pub quantity: f64,
    pub movement_type: String,
    pub reason: Option<String>,
    pub reference: Option<String>,
    pub movement_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockBalanceDto {
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub current_balance: String,
    pub minimum_stock: String,
    pub is_low_stock: bool,
}
