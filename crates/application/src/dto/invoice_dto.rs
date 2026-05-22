use domain::sales::{Invoice, UnifiedInvoice, InvoiceLine, InvoiceType, InvoiceStatus, PaymentMethod};
use domain::shared::monetary_amount::MonetaryAmount;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonetaryAmountDto {
    pub original_amount: String,
    pub original_currency: String,
    pub base_amount: String,
    pub fx_rate: String,
}

impl From<MonetaryAmount> for MonetaryAmountDto {
    fn from(m: MonetaryAmount) -> Self {
        Self {
            original_amount: m.original.amount().to_string(),
            original_currency: m.original.currency().code.clone(),
            base_amount: m.base_amount.to_string(),
            fx_rate: m.fx_rate.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLineDto {
    pub material_id: String,
    pub material_name: Option<String>,
    pub barcode: Option<String>,
    pub code: Option<String>,
    pub category_name: Option<String>,
    pub quantity: String,
    pub unit_id: Option<String>,
    pub conversion_factor: Option<String>,
    pub unit_price: String, // Selection
    pub unit_price_v2: Option<MonetaryAmountDto>,
    pub purchase_price: Option<String>,
    pub purchase_price_v2: Option<MonetaryAmountDto>,
    pub retail_price: Option<String>,
    pub retail_price_v2: Option<MonetaryAmountDto>,
    pub wholesale_price: Option<String>,
    pub wholesale_price_v2: Option<MonetaryAmountDto>,
    pub semi_wholesale_price: Option<String>,
    pub semi_wholesale_price_v2: Option<MonetaryAmountDto>,
    pub minimum_stock: Option<String>,
    pub notes: Option<String>,
    pub unit_price_usd: Option<String>,
    pub purchase_price_usd: Option<String>,
    pub profit_amount_usd: Option<String>,
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
    pub tax_amount_v2: Option<MonetaryAmountDto>,
    pub discount_amount: String,
    pub discount_amount_v2: Option<MonetaryAmountDto>,
    pub total_amount: String,
    pub total_amount_v2: Option<MonetaryAmountDto>,
    pub payment_method: String,
    pub amount_paid: String,
    pub amount_paid_v2: Option<MonetaryAmountDto>,
    pub status: String,
    pub issued_at: String,
    pub currency_code: String,
    pub exchange_rate: String,
    pub notes: Option<String>,
    pub subtotal_amount: String,
    pub subtotal_amount_v2: Option<MonetaryAmountDto>,
    pub extra_costs: String,
    pub extra_costs_v2: Option<MonetaryAmountDto>,
    pub remaining_amount: String,
    pub remaining_amount_v2: Option<MonetaryAmountDto>,
    pub total_profit: Option<String>,
    pub profit_percent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateInvoiceRequest {
    pub invoice_number: String,
    pub invoice_type: String,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub lines: Vec<InvoiceLineDto>,
    pub tax_amount: String,
    pub discount_amount: String,
    pub extra_costs: Option<String>,
    pub payment_method: String,
    pub amount_paid: String,
    pub issued_at: String,
    pub currency_code: String,
    pub exchange_rate: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInvoiceRequest {
    pub id: String,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub supplier_id: Option<String>,
    pub supplier_name: Option<String>,
    pub lines: Vec<InvoiceLineDto>,
    pub tax_amount: String,
    pub discount_amount: String,
    pub extra_costs: Option<String>,
    pub notes: Option<String>,
}

impl From<Invoice> for InvoiceDto {
    fn from(invoice: Invoice) -> Self {
        let status = if invoice.posted { "Posted" } else { "Draft" };
        let subtotal = invoice.subtotal();
        let total = invoice.total();

        Self {
            id: invoice.id.0.to_string(),
            invoice_number: invoice.invoice_number,
            invoice_type: "Sales".to_string(),
            customer_id: Some(invoice.customer_id.0.to_string()),
            customer_name: None,
            supplier_id: None,
            supplier_name: None,
            lines: invoice.lines.into_iter().map(InvoiceLineDto::from).collect(),
            tax_amount: invoice.tax_amount.amount().to_string(),
            tax_amount_v2: None,
            discount_amount: invoice.discount_amount.amount().to_string(),
            discount_amount_v2: None,
            total_amount: total.amount().to_string(),
            total_amount_v2: None,
            payment_method: "Cash".to_string(),
            amount_paid: total.amount().to_string(),
            amount_paid_v2: None,
            status: status.to_string(),
            issued_at: invoice.issued_at.to_rfc3339(),
            currency_code: invoice.tax_amount.currency().code.clone(),
            exchange_rate: "1".to_string(),
            notes: None,
            subtotal_amount: subtotal.amount().to_string(),
            subtotal_amount_v2: None,
            extra_costs: "0".to_string(),
            extra_costs_v2: None,
            remaining_amount: "0".to_string(),
            remaining_amount_v2: None,
            total_profit: None,
            profit_percent: None,
        }
    }
}

impl From<UnifiedInvoice> for InvoiceDto {
    fn from(invoice: UnifiedInvoice) -> Self {
        let invoice_type = match invoice.invoice_type {
            InvoiceType::Sales => "Sales",
            InvoiceType::Purchase => "Purchase",
            InvoiceType::PurchaseCosts => "PurchaseCosts",
            InvoiceType::OpeningBalance => "OpeningBalance",
        };

        let status = match invoice.status {
            InvoiceStatus::Draft => "Draft",
            InvoiceStatus::Posted => "Posted",
            InvoiceStatus::Cancelled => "Cancelled",
            InvoiceStatus::Reversed => "Reversed",
        };

        let subtotal = invoice.subtotal();
        let total = invoice.total_amount.clone();
        let extra = invoice.extra_costs.clone();

        let amount_paid = invoice.amount_paid.clone();
        let code = &invoice.currency_code;
        let remaining = (total.clone() - amount_paid.clone()).unwrap_or_else(|_| MonetaryAmount::zero(domain::shared::currency::Currency::new(code, code, code, "", 2, false)));

        Self {
            id: invoice.id.0.to_string(),
            invoice_number: invoice.invoice_number,
            invoice_type: invoice_type.to_string(),
            customer_id: invoice.customer_id.map(|id| id.0.to_string()),
            customer_name: invoice.customer_name,
            supplier_id: invoice.supplier_id.map(|id| id.0.to_string()),
            supplier_name: invoice.supplier_name,
            lines: invoice.lines.into_iter().map(InvoiceLineDto::from).collect(),
            tax_amount: invoice.tax_amount.amount().to_string(),
            tax_amount_v2: Some(MonetaryAmountDto::from(invoice.tax_amount)),
            discount_amount: invoice.discount_amount.amount().to_string(),
            discount_amount_v2: Some(MonetaryAmountDto::from(invoice.discount_amount)),
            total_amount: invoice.total_amount.amount().to_string(),
            total_amount_v2: Some(MonetaryAmountDto::from(invoice.total_amount)),
            payment_method: match invoice.payment_method {
                PaymentMethod::Cash => "Cash",
                PaymentMethod::Deferred => "Deferred",
                PaymentMethod::Partial => "Partial",
            }.to_string(),
            amount_paid: invoice.amount_paid.amount().to_string(),
            amount_paid_v2: Some(MonetaryAmountDto::from(invoice.amount_paid)),
            status: status.to_string(),
            issued_at: invoice.issued_at.to_rfc3339(),
            currency_code: invoice.currency_code,
            exchange_rate: invoice.exchange_rate.to_string(),
            notes: invoice.notes,
            subtotal_amount: subtotal.amount().to_string(),
            subtotal_amount_v2: Some(MonetaryAmountDto::from(subtotal)),
            extra_costs: extra.amount().to_string(),
            extra_costs_v2: Some(MonetaryAmountDto::from(extra)),
            remaining_amount: remaining.amount().to_string(),
            remaining_amount_v2: Some(MonetaryAmountDto::from(remaining)),
            total_profit: None,
            profit_percent: None,
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
            unit_id: line.unit_id,
            conversion_factor: line.conversion_factor.map(|c| c.to_string()),
            unit_price: line.unit_price.amount().to_string(),
            unit_price_v2: Some(MonetaryAmountDto::from(line.unit_price)),
            purchase_price: line.purchase_price.clone().map(|m| m.amount().to_string()),
            purchase_price_v2: line.purchase_price.map(MonetaryAmountDto::from),
            retail_price: line.retail_price.clone().map(|m| m.amount().to_string()),
            retail_price_v2: line.retail_price.map(MonetaryAmountDto::from),
            wholesale_price: line.wholesale_price.clone().map(|m| m.amount().to_string()),
            wholesale_price_v2: line.wholesale_price.map(MonetaryAmountDto::from),
            semi_wholesale_price: line.semi_wholesale_price.clone().map(|m| m.amount().to_string()),
            semi_wholesale_price_v2: line.semi_wholesale_price.map(MonetaryAmountDto::from),
            minimum_stock: line.minimum_stock.map(|s| s.to_string()),
            notes: line.notes,
            unit_price_usd: line.unit_price_usd.map(|m| m.amount().to_string()),
            purchase_price_usd: line.purchase_price_usd.map(|m| m.amount().to_string()),
            profit_amount_usd: line.profit_amount_usd.map(|m| m.amount().to_string()),
        }
    }
}
