#[derive(sqlx::FromRow)]
pub struct DamagedItemRow {
    pub id: String,
    pub material_id: String,
    pub quantity: String,
    pub reason: String,
    pub damage_date: String,
    pub cost_impact: String,
    pub notes: Option<String>,
    pub reference: Option<String>,
    pub created_at: String,
}
