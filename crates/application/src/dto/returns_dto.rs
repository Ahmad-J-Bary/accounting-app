use domain::returns::{SalesReturn, PurchaseReturn};
use domain::returns::sales_return::SalesReturnLine;
use domain::returns::purchase_return::PurchaseReturnLine;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesReturnLineDto {
    pub id: String,
    pub material_id: String,
    pub material_name: Option<String>,
    pub quantity: String,
    pub unit_price: String,
    pub unit_id: Option<String>,
    pub line_total: String,
    pub notes: Option<String>,
    pub invoice_line_id: Option<String>,
}

impl From<SalesReturnLine> for SalesReturnLineDto {
    fn from(l: SalesReturnLine) -> Self {
        Self {
            id: l.id.to_string(),
            material_id: l.material_id.0.to_string(),
            material_name: None,
            quantity: l.quantity.to_string(),
            unit_price: l.unit_price.to_string(),
            unit_id: l.unit_id,
            line_total: l.line_total.to_string(),
            notes: l.notes.clone(),
            invoice_line_id: l.invoice_line_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalesReturnDto {
    pub id: String,
    pub return_number: String,
    pub customer_id: String,
    pub customer_name: Option<String>,
    pub return_date: String,
    pub lines: Vec<SalesReturnLineDto>,
    pub total_amount: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl From<SalesReturn> for SalesReturnDto {
    fn from(r: SalesReturn) -> Self {
        Self {
            id: r.id.0.to_string(),
            return_number: r.return_number,
            customer_id: r.customer_id.0.to_string(),
            customer_name: None,
            return_date: r.return_date.to_rfc3339(),
            lines: r.lines.into_iter().map(Into::into).collect(),
            total_amount: r.total_amount.to_string(),
            notes: r.notes,
            created_at: r.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSalesReturnRequest {
    pub id: Option<String>,
    pub return_number: String,
    pub customer_id: String,
    pub customer_name: Option<String>,
    pub return_date: String,
    pub lines: Vec<SalesReturnLineDto>,
    pub notes: Option<String>,
    pub settlement_mode: Option<String>,
    pub settlement_amount: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturnLineDto {
    pub id: String,
    pub material_id: String,
    pub material_name: Option<String>,
    pub quantity: String,
    pub unit_price: String,
    pub unit_id: Option<String>,
    pub line_total: String,
    pub notes: Option<String>,
    pub invoice_line_id: Option<String>,
}

impl From<PurchaseReturnLine> for PurchaseReturnLineDto {
    fn from(l: PurchaseReturnLine) -> Self {
        Self {
            id: l.id.to_string(),
            material_id: l.material_id.0.to_string(),
            material_name: None,
            quantity: l.quantity.to_string(),
            unit_price: l.unit_price.to_string(),
            unit_id: l.unit_id,
            line_total: l.line_total.to_string(),
            notes: l.notes.clone(),
            invoice_line_id: l.invoice_line_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseReturnDto {
    pub id: String,
    pub return_number: String,
    pub supplier_id: String,
    pub supplier_name: Option<String>,
    pub return_date: String,
    pub lines: Vec<PurchaseReturnLineDto>,
    pub total_amount: String,
    pub notes: Option<String>,
    pub created_at: String,
}

impl From<PurchaseReturn> for PurchaseReturnDto {
    fn from(r: PurchaseReturn) -> Self {
        Self {
            id: r.id.0.to_string(),
            return_number: r.return_number,
            supplier_id: r.supplier_id.0.to_string(),
            supplier_name: None,
            return_date: r.return_date.to_rfc3339(),
            lines: r.lines.into_iter().map(Into::into).collect(),
            total_amount: r.total_amount.to_string(),
            notes: r.notes,
            created_at: r.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePurchaseReturnRequest {
    pub id: Option<String>,
    pub return_number: String,
    pub supplier_id: String,
    pub supplier_name: Option<String>,
    pub return_date: String,
    pub lines: Vec<PurchaseReturnLineDto>,
    pub notes: Option<String>,
    pub settlement_mode: Option<String>,
    pub settlement_amount: Option<String>,
}
