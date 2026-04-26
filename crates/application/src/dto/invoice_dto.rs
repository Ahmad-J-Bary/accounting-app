use domain::sales::{UnifiedInvoice, InvoiceLine, InvoiceType, InvoiceStatus};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLineDto {
    pub material_id: String,
    pub material_name: Option<String>,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub category_name: Option<String>,
    pub quantity: String,
    pub unit_price: String, // Selection
    pub purchase_price: Option<String>,
    pub retail_price: Option<String>,
    pub wholesale_price: Option<String>,
    pub semi_wholesale_price: Option<String>,
    pub minimum_stock: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDto {
    pub id: String,
    pub invoice_number: String,
    pub invoice_type: String, // "Sales", "Purchase", "OpeningBalance"
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub lines: Vec<InvoiceLineDto>,
    pub tax_amount: String,
    pub discount_amount: String,
    pub total_amount: String,
    pub status: String,
    pub issued_at: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceRequest {
    pub invoice_number: String,
    pub invoice_type: String,
    pub customer_id: Option<String>,
    pub supplier_id: Option<String>,
    pub lines: Vec<InvoiceLineDto>,
    pub tax_amount: String,
    pub discount_amount: String,
    pub issued_at: String,
    pub notes: Option<String>,
}

impl From<UnifiedInvoice> for InvoiceDto {
    fn from(invoice: UnifiedInvoice) -> Self {
        let invoice_type = match invoice.invoice_type {
            InvoiceType::Sales => "Sales",
            InvoiceType::Purchase => "Purchase",
            InvoiceType::OpeningBalance => "OpeningBalance",
        };

        let status = match invoice.status {
            InvoiceStatus::Draft => "Draft",
            InvoiceStatus::Posted => "Posted",
            InvoiceStatus::Cancelled => "Cancelled",
            InvoiceStatus::Reversed => "Reversed",
        };

        Self {
            id: invoice.id.0.to_string(),
            invoice_number: invoice.invoice_number,
            invoice_type: invoice_type.to_string(),
            customer_id: invoice.customer_id.map(|id| id.0.to_string()),
            customer_name: None,
            supplier_id: invoice.supplier_id.map(|id| id.0.to_string()),
            supplier_name: None,
            lines: invoice.lines.into_iter().map(InvoiceLineDto::from).collect(),
            tax_amount: invoice.tax_amount.amount().to_string(),
            discount_amount: invoice.discount_amount.amount().to_string(),
            total_amount: invoice.total_amount.amount().to_string(),
            status: status.to_string(),
            issued_at: invoice.issued_at.to_rfc3339(),
            notes: invoice.notes,
        }
    }
}

impl From<InvoiceLine> for InvoiceLineDto {
    fn from(line: InvoiceLine) -> Self {
        Self {
            material_id: line.material_id.0.to_string(),
            material_name: None,
            barcode: None,
            code: None,
            category_name: None,
            quantity: line.quantity.to_string(),
            unit_price: line.unit_price.amount().to_string(),
            purchase_price: line.purchase_price.map(|m| m.amount().to_string()),
            retail_price: line.retail_price.map(|m| m.amount().to_string()),
            wholesale_price: line.wholesale_price.map(|m| m.amount().to_string()),
            semi_wholesale_price: line.semi_wholesale_price.map(|m| m.amount().to_string()),
            minimum_stock: line.minimum_stock.map(|s| s.to_string()),
            notes: line.notes,
        }
    }
}
