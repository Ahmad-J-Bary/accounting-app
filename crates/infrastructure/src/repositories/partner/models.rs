#[derive(sqlx::FromRow)]
pub struct PartnerRow {
    pub id: i64,
    pub name: String,
    pub exchange_rate: String,
    pub amount_local: String,
    pub amount_usd: String,
    pub is_amount_in_usd: bool,
    pub profit_sharing_ratio: Option<String>,
    pub profit_sharing_type: String,
    pub linked_account_id: Option<String>,
    pub drawings_account_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
