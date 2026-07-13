#[derive(sqlx::FromRow)]
pub struct PurchaseInvoiceRow {
    pub id: String,
    pub invoice_number: String,
    pub supplier_id: String,
    pub subtotal: String,
    pub tax_amount: String,
    pub discount_amount: String,
    pub total: String,
    pub amount_paid: String,
    pub status: String,
    pub invoice_date: String,
    pub due_date: Option<String>,
    pub currency_code: String,
    pub exchange_rate: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(sqlx::FromRow)]
pub struct PurchaseInvoiceItemRow {
    pub id: String,
    pub purchase_invoice_id: String,
    pub material_id: String,
    pub quantity: String,
    pub unit_id: Option<String>,
    pub conversion_factor: Option<String>,
    pub unit_price: String,
    pub line_total: String,
    pub notes: Option<String>,
}

#[derive(sqlx::FromRow)]
pub struct PurchaseInvoiceAdditionalCostRow {
    pub id: String,
    pub purchase_invoice_id: String,
    pub description: String,
    pub account_id: String,
    pub amount: String,
}
