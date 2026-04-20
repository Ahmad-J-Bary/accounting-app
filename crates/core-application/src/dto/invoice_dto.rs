use core_domain::sales::{Invoice, InvoiceLine};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLineDto {
    pub product_id: String,
    pub quantity: String,
    pub unit_price: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDto {
    pub id: String,
    pub customer_id: String,
    pub lines: Vec<InvoiceLineDto>,
    pub issued_at: String,
    pub posted: bool,
    pub total: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceRequest {
    pub customer_id: String,
    pub lines: Vec<InvoiceLineDto>,
}

impl From<Invoice> for InvoiceDto {
    fn from(invoice: Invoice) -> Self {
        let total = invoice.total().amount().to_string();
        Self {
            id: invoice.id.0.to_string(),
            customer_id: invoice.customer_id.0.to_string(),
            lines: invoice.lines.into_iter().map(InvoiceLineDto::from).collect(),
            issued_at: invoice.issued_at.to_rfc3339(),
            posted: invoice.posted,
            total,
        }
    }
}

impl From<InvoiceLine> for InvoiceLineDto {
    fn from(line: InvoiceLine) -> Self {
        Self {
            product_id: line.product_id.0.to_string(),
            quantity: line.quantity.to_string(),
            unit_price: line.unit_price.amount().to_string(),
        }
    }
}
