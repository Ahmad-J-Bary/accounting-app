#[derive(sqlx::FromRow)]
pub struct ConsumableRow {
    pub id: String,
    pub code: String,
    pub name: String,
    pub category_id: String,
    pub quantity_on_hand: String,
    pub unit_cost: String,
    pub currency: String,
    pub fx_rate: String,
    pub status: String,
    pub location: String,
    pub notes: Option<String>,
    pub asset_account_id: String,
    pub expense_account_id: String,
    pub created_at: String,
    pub updated_at: String,
}
