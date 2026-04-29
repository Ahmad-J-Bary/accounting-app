#[derive(sqlx::FromRow)]
pub struct AdjustmentRow {
    pub id: String,
    pub material_id: String,
    pub system_quantity: String,
    pub actual_quantity: String,
    pub difference: String,
    pub reason: Option<String>,
    pub adjustment_date: String,
    pub created_at: String,
}
