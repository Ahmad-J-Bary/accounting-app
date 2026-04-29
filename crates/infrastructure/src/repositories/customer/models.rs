#[derive(sqlx::FromRow)]
pub struct CustomerRow {
    pub id: String,
    pub code: String,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub account_id: Option<String>,
    pub debit: String,
    pub credit: String,
    pub opening_balance: String,
    pub balance: String,
    pub currency: String,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}
