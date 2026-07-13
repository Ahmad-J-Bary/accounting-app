#[allow(dead_code)]
#[derive(sqlx::FromRow)]
pub struct InvoiceRow {
    pub id: String,
    pub invoice_number: String,
    pub customer_id: String,
    pub subtotal: String,
    pub tax_amount: String,
    pub discount_amount: String,
    pub total: String,
    pub status: String,
    pub invoice_date: String,
    pub created_at: String,
    pub updated_at: String,
}

#[allow(dead_code)]
#[derive(sqlx::FromRow)]
pub struct InvoiceItemRow {
    pub id: String,
    pub sales_invoice_id: String,
    pub material_id: String,
    pub quantity: String,
    pub unit_price: String,
    pub line_total: String,
}
