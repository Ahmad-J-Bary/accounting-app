use domain::sales::{Invoice, InvoiceLine};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLineDto {
    pub product_id: String,
    pub product_name: Option<String>,
    pub quantity: String,
    pub unit_price: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDto {
    pub id: String,
    pub invoice_number: String,
    pub customer_id: String,
    pub customer_name: Option<String>,
    pub lines: Vec<InvoiceLineDto>,
    pub subtotal: String,
    pub tax_amount: String,
    pub discount_amount: String,
    pub total: String,
    pub issued_at: String,
    pub posted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceRequest {
    pub invoice_number: String,
    pub customer_id: String,
    pub lines: Vec<InvoiceLineDto>,
    pub tax_amount: String,
    pub discount_amount: String,
}

impl From<Invoice> for InvoiceDto {
    fn from(invoice: Invoice) -> Self {
        let subtotal = invoice.subtotal().amount().to_string();
        let tax_amount = invoice.tax_amount.amount().to_string();
        let discount_amount = invoice.discount_amount.amount().to_string();
        let total = invoice.total().amount().to_string();
        
        Self {
            id: invoice.id.0.to_string(),
            invoice_number: invoice.invoice_number,
            customer_id: invoice.customer_id.0.to_string(),
            customer_name: None,
            lines: invoice.lines.into_iter().map(InvoiceLineDto::from).collect(),
            subtotal,
            tax_amount,
            discount_amount,
            total,
            issued_at: invoice.issued_at.to_rfc3339(),
            posted: invoice.posted,
        }
    }
}

impl From<InvoiceLine> for InvoiceLineDto {
    fn from(line: InvoiceLine) -> Self {
        Self {
            product_id: line.product_id.0.to_string(),
            product_name: None,
            quantity: line.quantity.to_string(),
            unit_price: line.unit_price.amount().to_string(),
        }
    }
}
