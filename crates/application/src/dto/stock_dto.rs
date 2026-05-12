use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovementDetailDto {
    pub id: String,
    pub material_id: String,
    pub movement_type: String,       // "Purchase" | "Sale" | "OpeningBalance" | etc.
    pub movement_type_label: String, // Arabic label
    pub quantity: String,
    pub unit_cost: String,
    pub unit_cost_base: String,
    pub total_cost: String,
    pub total_cost_base: String,
    pub currency: Option<String>,
    pub fx_rate: String,
    pub reference: String,
    pub notes: String,
    pub movement_date: String,       // ISO 8601
    pub invoice_number: Option<String>,
    pub invoice_type: Option<String>,
    pub party_name: Option<String>,  // customer or supplier name
    pub balance_before: String,      // running balance before this movement
    pub balance_after: String,       // running balance after this movement
    pub is_inflow: bool,
}

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
    pub unit_id: Option<String>,
    pub conversion_factor: Option<String>,
    pub unit_cost: String,
    pub unit_cost_base: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordOpeningStockRequest {
    pub items: Vec<OpeningStockItem>,
    pub date: String,
    pub currency_code: String,
    pub exchange_rate: String,
    pub notes: Option<String>,
}
