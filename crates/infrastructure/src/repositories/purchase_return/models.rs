use sqlx::FromRow;

#[derive(Debug, FromRow)]
pub struct PurchaseReturnRow {
    pub id: String,
    pub return_number: String,
    pub supplier_id: String,
    pub return_date: String,
    pub total_amount: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, FromRow)]
pub struct PurchaseReturnLineRow {
    pub id: String,
    #[allow(dead_code)]
    pub purchase_return_id: String,
    pub material_id: String,
    pub quantity: String,
    pub unit_price: String,
    pub unit_id: Option<String>,
    pub line_total: String,
    pub notes: Option<String>,
    pub invoice_line_id: Option<String>,
}
