use sqlx::FromRow;

#[derive(FromRow, Debug, Clone)]
pub struct InventoryLotRow {
    pub id: String,
    pub material_id: String,
    pub purchase_invoice_id: Option<String>,
    pub movement_id: String,
    pub quantity_original: String,
    pub quantity_remaining: String,
    pub unit_cost_base: String,
    pub raw_unit_cost_base: String,
    pub currency_code: Option<String>,
    pub fx_rate: String,
    pub purchase_date: String,
    pub created_at: String,
}

#[derive(FromRow, Debug, Clone)]
pub struct CostingMethodRow {
    pub costing_method: String,
}
