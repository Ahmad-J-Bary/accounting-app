#[derive(sqlx::FromRow)]
pub struct StockMovementRow {
    pub id: String,
    pub material_id: String,
    pub quantity: String,
    pub unit_cost: String,
    pub unit_cost_base: String,
    pub total_cost: String,
    pub total_cost_base: String,
    pub raw_total_cost_base: Option<String>,
    pub original_currency: Option<String>,
    pub fx_rate: String,
    pub movement_type: String,
    pub reason: Option<String>,
    pub reference: Option<String>,
    pub movement_date: String,
    pub created_at: String,
}
