#[derive(sqlx::FromRow)]
pub struct PaymentRow {
    pub id: String,
    pub payment_type: String,
    pub amount: String,
    pub payment_date: String,
    pub customer_id: Option<String>,
    pub supplier_id: Option<String>,
    pub reference: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
