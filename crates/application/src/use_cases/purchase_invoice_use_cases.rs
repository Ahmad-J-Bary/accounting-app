use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::purchases::{PurchaseInvoice, PurchaseInvoiceItem};
use domain::shared::ids::{SupplierId, ProductId};
use crate::ports::purchase_invoice_repository::PurchaseInvoiceRepository;
use crate::dto::purchase_invoice_dto::{
    CreatePurchaseInvoiceRequest, PurchaseInvoiceDto, PurchaseInvoiceItemDto,
};
use crate::errors::AppError;

fn to_dto(inv: PurchaseInvoice) -> PurchaseInvoiceDto {
    let subtotal = inv.subtotal.to_string();
    let tax_amount = inv.tax_amount.to_string();
    let discount_amount = inv.discount_amount.to_string();
    let total = inv.total.to_string();
    let amount_paid = inv.amount_paid.to_string();
    let remaining_amount = inv.remaining_amount().to_string();
    let status = format!("{:?}", inv.status);
    let invoice_date = inv.invoice_date.to_rfc3339();
    let due_date = inv.due_date.map(|d| d.to_rfc3339());
    let notes = inv.notes.clone();
    let created_at = inv.created_at.to_rfc3339();
    let updated_at = inv.updated_at.to_rfc3339();

    PurchaseInvoiceDto {
        id: inv.id.to_string(),
        invoice_number: inv.invoice_number,
        supplier_id: inv.supplier_id.to_string(),
        supplier_name: None,
        items: inv.items.into_iter().map(|i| PurchaseInvoiceItemDto {
            id: i.id,
            product_id: i.product_id.to_string(),
            product_name: None,
            quantity: i.quantity.to_string(),
            unit_price: i.unit_price.to_string(),
            line_total: i.line_total.to_string(),
            notes: i.notes,
        }).collect(),
        subtotal,
        tax_amount,
        discount_amount,
        total,
        amount_paid,
        remaining_amount,
        status,
        invoice_date,
        due_date,
        notes,
        created_at,
        updated_at,
    }
}

pub struct CreatePurchaseInvoiceUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
}

impl CreatePurchaseInvoiceUseCase {
    pub fn new(repo: Arc<dyn PurchaseInvoiceRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreatePurchaseInvoiceRequest) -> Result<PurchaseInvoiceDto, AppError> {
        let supplier_id: SupplierId = req.supplier_id.parse()
            .map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;

        let invoice_date = DateTime::parse_from_rfc3339(&req.invoice_date)
            .map_err(|_| AppError::Invalid("ØªØ§Ø±ÙŠØ® Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± ØµØ§Ù„Ø­".into()))?
            .with_timezone(&chrono::Utc);

        let due_date = req.due_date.map(|d| {
            DateTime::parse_from_rfc3339(&d)
                .map(|dt| dt.with_timezone(&chrono::Utc))
        }).transpose().map_err(|_| AppError::Invalid("ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;

        let mut invoice = PurchaseInvoice::new(
            req.invoice_number,
            supplier_id,
            invoice_date,
            due_date,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        for item_req in req.items {
            let product_id: ProductId = item_req.product_id.parse()
                .map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
            let quantity = Decimal::try_from(item_req.quantity)
                .map_err(|_| AppError::Invalid("Ø§Ù„ÙƒÙ…ÙŠØ© ØºÙŠØ± ØµØ§Ù„Ø­Ø©".into()))?;
            let unit_price = Decimal::try_from(item_req.unit_price)
                .map_err(|_| AppError::Invalid("Ø§Ù„Ø³Ø¹Ø± ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
            let item = PurchaseInvoiceItem::new(product_id, quantity, unit_price)
                .map_err(|e| AppError::Invalid(e.to_string()))?;
            invoice.add_item(item).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        if let Some(tax) = req.tax_amount {
            let tax_dec = Decimal::try_from(tax)
                .map_err(|_| AppError::Invalid("Ù‚ÙŠÙ…Ø© Ø§Ù„Ø¶Ø±ÙŠØ¨Ø© ØºÙŠØ± ØµØ§Ù„Ø­Ø©".into()))?;
            invoice.set_tax(tax_dec).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        if let Some(discount) = req.discount_amount {
            let disc_dec = Decimal::try_from(discount)
                .map_err(|_| AppError::Invalid("Ù‚ÙŠÙ…Ø© Ø§Ù„Ø®ØµÙ… ØºÙŠØ± ØµØ§Ù„Ø­Ø©".into()))?;
            invoice.set_discount(disc_dec).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        self.repo.save(&invoice).await?;
        Ok(to_dto(invoice))
    }
}

pub struct ListPurchaseInvoicesUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
}

impl ListPurchaseInvoicesUseCase {
    pub fn new(repo: Arc<dyn PurchaseInvoiceRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, supplier_id: Option<String>) -> Result<Vec<PurchaseInvoiceDto>, AppError> {
        let invoices = if let Some(sid) = supplier_id {
            let supplier_id: SupplierId = sid.parse()
                .map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
            self.repo.list_by_supplier(&supplier_id).await?
        } else {
            self.repo.list_all().await?
        };
        Ok(invoices.into_iter().map(to_dto).collect())
    }
}

pub struct PostPurchaseInvoiceUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
}

impl PostPurchaseInvoiceUseCase {
    pub fn new(repo: Arc<dyn PurchaseInvoiceRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, invoice_id: String) -> Result<PurchaseInvoiceDto, AppError> {
        let pid = invoice_id.parse()
            .map_err(|_| AppError::NotFound("Ù…Ø¹Ø±Ù Ø§Ù„ÙØ§ØªÙˆØ±Ø© ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
        let mut invoice = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("ÙØ§ØªÙˆØ±Ø© Ø§Ù„Ø´Ø±Ø§Ø¡ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø©".into()))?;
        invoice.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.update(&invoice).await?;
        Ok(to_dto(invoice))
    }
}
