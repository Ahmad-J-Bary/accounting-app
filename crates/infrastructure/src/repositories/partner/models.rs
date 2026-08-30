#[derive(sqlx::FromRow)]
pub struct PartnerRow {
    pub id: String,
    pub code: String,
    pub name: String,
    pub currency: String,
    pub exchange_rate: String,
    pub amount_local: String,
    pub amount_original: String,
    pub is_amount_in_original: bool,
    pub profit_sharing_ratio: Option<String>,
    pub profit_sharing_type: String,
    pub linked_account_id: Option<String>,
    pub drawings_account_id: Option<String>,
    pub current_account_id: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
