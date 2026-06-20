use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovementDetailDto {
    pub id: String,
    pub material_id: String,
    pub movement_type: String,
    pub movement_type_label: String,
    pub quantity: String,
    pub unit_cost: String,
    pub unit_cost_base: String,
    pub total_cost: String,
    pub total_cost_base: String,
    pub currency: Option<String>,
    pub fx_rate: String,
    pub reference: String,
    pub notes: String,
    pub movement_date: String,
    pub invoice_number: Option<String>,
    pub invoice_type: Option<String>,
    pub party_name: Option<String>,
    pub warehouse_id: Option<String>,
    pub warehouse_name: Option<String>,
    pub balance_before: String,
    pub balance_after: String,
    pub is_inflow: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockMovementDto {
    pub id: String,
    pub material_id: String,
    pub material_name: Option<String>,
    pub quantity: String,
    pub movement_type: String,
    pub unit_cost: Option<String>,
    pub unit_cost_base: Option<String>,
    pub total_cost: Option<String>,
    pub total_cost_base: Option<String>,
    pub original_currency: Option<String>,
    pub fx_rate: Option<String>,
    pub reason: Option<String>,
    pub reference: Option<String>,
    pub source_document_id: Option<String>,
    pub warehouse_id: Option<String>,
    pub movement_date: String,
    pub created_at: String,
    pub signed_quantity: Option<String>,
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
