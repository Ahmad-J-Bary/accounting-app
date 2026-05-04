use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseInvoiceItemDto {
    pub id: String,
    pub product_id: String,
    pub product_name: Option<String>,
    pub quantity: String,
    pub unit_price: String,
    pub line_total: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseInvoiceDto {
    pub id: String,
    pub invoice_number: String,
    pub supplier_id: String,
    pub supplier_name: Option<String>,
    pub items: Vec<PurchaseInvoiceItemDto>,
    pub subtotal: String,
    pub tax_amount: String,
    pub discount_amount: String,
    pub total: String,
    pub amount_paid: String,
    pub remaining_amount: String,
    pub status: String,
    pub invoice_date: String,
    pub due_date: Option<String>,
    pub currency_code: String,
    pub exchange_rate: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseInvoiceItemRequest {
    pub product_id: String,
    pub quantity: String,
    pub unit_price: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseInvoiceRequest {
    pub invoice_number: String,
    pub supplier_id: String,
    pub items: Vec<CreatePurchaseInvoiceItemRequest>,
    pub tax_amount: Option<String>,
    pub discount_amount: Option<String>,
    pub invoice_date: String,
    pub due_date: Option<String>,
    pub currency_code: String,
    pub exchange_rate: String,
    pub notes: Option<String>,
}
