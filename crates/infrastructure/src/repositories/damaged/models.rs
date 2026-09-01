#[derive(sqlx::FromRow)]
pub struct DamagedItemRow {
    pub id: String,
    pub material_id: String,
    pub quantity: String,
    pub reason: Option<String>,
    pub damage_date: String,
    pub cost_impact: String,
    pub cost_impact_base: Option<String>,
    pub loss: Option<String>,
    pub loss_base: Option<String>,
    pub currency_code: Option<String>,
    pub fx_rate: Option<String>,
    pub notes: Option<String>,
    pub reference: Option<String>,
    pub created_at: String,
}
