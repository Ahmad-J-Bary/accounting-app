use std::sync::Arc;
use chrono::DateTime;
// Removed unused Decimal import
use domain::purchases::{PurchaseInvoice, PurchaseInvoiceItem};
use domain::shared::ids::{SupplierId, MaterialId};
use crate::ports::purchase_invoice_repository::PurchaseInvoiceRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use crate::dto::purchase_invoice_dto::{
    CreatePurchaseInvoiceRequest, PurchaseInvoiceDto, PurchaseInvoiceItemDto,
};
use crate::errors::AppError;

async fn enrich_invoice(
    inv: PurchaseInvoice,
    supplier_repo: &Arc<dyn SupplierRepository>,
    material_repo: &Arc<dyn MaterialRepository>,
) -> PurchaseInvoiceDto {
    let remaining_amount = inv.remaining_amount().to_string();
    let id = inv.id.to_string();
    let invoice_number = inv.invoice_number.clone();
    let supplier_id = inv.supplier_id.to_string();
    let subtotal = inv.subtotal.to_string();
    let tax_amount = inv.tax_amount.to_string();
    let discount_amount = inv.discount_amount.to_string();
    let total = inv.total.to_string();
    let amount_paid = inv.amount_paid.to_string();
    let status = format!("{:?}", inv.status);
    let invoice_date = inv.invoice_date.to_rfc3339();
    let due_date = inv.due_date.map(|d| d.to_rfc3339());
    let currency_code = inv.currency_code.clone();
    let exchange_rate = inv.exchange_rate.to_string();
    let notes = inv.notes.clone();
    let created_at = inv.created_at.to_rfc3339();
    let updated_at = inv.updated_at.to_rfc3339();

    let mut supplier_name = None;
    if let Ok(Some(supplier)) = supplier_repo.find_by_id(&inv.supplier_id).await {
        supplier_name = Some(supplier.name);
    }

    let mut items = Vec::new();
    for i in &inv.items {
        let mut material_name = None;
        if let Ok(Some(material)) = material_repo.find_by_id(&i.material_id).await {
            material_name = Some(material.name);
        }
        items.push(PurchaseInvoiceItemDto {
            id: i.id.clone(),
            product_id: i.material_id.to_string(),
            product_name: material_name,
            quantity: i.quantity.to_string(),
            unit_price: i.unit_price.to_string(),
            line_total: i.line_total.to_string(),
            notes: i.notes.clone(),
        });
    }

    PurchaseInvoiceDto {
        id,
        invoice_number,
        supplier_id,
        supplier_name,
        items,
        subtotal,
        tax_amount,
        discount_amount,
        total,
        amount_paid,
        remaining_amount,
        status,
        invoice_date,
        due_date,
        currency_code,
        exchange_rate,
        notes,
        created_at,
        updated_at,
    }
}

pub struct CreatePurchaseInvoiceUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl CreatePurchaseInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseInvoiceRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo }
    }

    pub async fn execute(&self, req: CreatePurchaseInvoiceRequest) -> Result<PurchaseInvoiceDto, AppError> {
        let supplier_id: SupplierId = req.supplier_id.parse()
            .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;

        let invoice_date = DateTime::parse_from_rfc3339(&req.invoice_date)
            .map_err(|_| AppError::Invalid("تاريخ الفاتورة غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let due_date = req.due_date.map(|d| {
            DateTime::parse_from_rfc3339(&d)
                .map(|dt| dt.with_timezone(&chrono::Utc))
        }).transpose().map_err(|_| AppError::Invalid("تاريخ الاستحقاق غير صالح".into()))?;

        let currency_code = req.currency_code.clone();
        let exchange_rate = crate::utils::parse_decimal(Some(&req.exchange_rate), "سعر الصرف")?;

        let mut invoice = PurchaseInvoice::new(
            req.invoice_number,
            supplier_id,
            invoice_date,
            due_date,
            currency_code,
            exchange_rate,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        for item_req in req.items {
            let material_id: MaterialId = item_req.product_id.parse()
                .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
            let quantity = crate::utils::parse_decimal(Some(&item_req.quantity), "الكمية")?;
            let unit_price = crate::utils::parse_decimal(Some(&item_req.unit_price), "السعر")?;
            let item = PurchaseInvoiceItem::new(material_id, quantity, unit_price)
                .map_err(|e| AppError::Invalid(e.to_string()))?;
            invoice.add_item(item).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        if let Some(tax) = req.tax_amount {
            let tax_dec = crate::utils::parse_decimal(Some(&tax), "قيمة الضريبة")?;
            invoice.set_tax(tax_dec).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        if let Some(discount) = req.discount_amount {
            let disc_dec = crate::utils::parse_decimal(Some(&discount), "قيمة الخصم")?;
            invoice.set_discount(disc_dec).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        self.repo.save(&invoice).await?;
        Ok(enrich_invoice(invoice, &self.supplier_repo, &self.material_repo).await)
    }
}

pub struct ListPurchaseInvoicesUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl ListPurchaseInvoicesUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseInvoiceRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo }
    }

    pub async fn execute(&self, supplier_id: Option<String>) -> Result<Vec<PurchaseInvoiceDto>, AppError> {
        let invoices = if let Some(sid) = supplier_id {
            let supplier_id: SupplierId = sid.parse()
                .map_err(|_| AppError::Invalid("معرف المورد غير صالح".into()))?;
            self.repo.list_by_supplier(&supplier_id).await?
        } else {
            self.repo.list_all().await?
        };

        let mut dtos = Vec::new();
        for inv in invoices {
            dtos.push(enrich_invoice(inv, &self.supplier_repo, &self.material_repo).await);
        }
        Ok(dtos)
    }
}

pub struct PostPurchaseInvoiceUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl PostPurchaseInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseInvoiceRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo, movement_repo }
    }

    pub async fn execute(&self, invoice_id: String) -> Result<PurchaseInvoiceDto, AppError> {
        let pid = invoice_id.parse()
            .map_err(|_| AppError::NotFound("معرف الفاتورة غير صالح".into()))?;
        let mut invoice = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("فاتورة الشراء غير موجودة".into()))?;
        invoice.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        // Update stock and record movements
        for item in &invoice.items {
            if let Ok(Some(material)) = self.material_repo.find_by_id(&item.material_id).await {
                // Record stock movement
                let movement = StockMovement::new(
                    material.id,
                    MovementType::Purchase,
                    item.quantity,
                    item.unit_price,
                    item.line_total,
                    invoice.invoice_number.clone(),
                    format!("شراء بموجب فاتورة مشتريات رقم {}", invoice.invoice_number),
                    chrono::Utc::now(),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;
                self.movement_repo.save(&movement).await?;
            }
        }

        self.repo.update(&invoice).await?;
        Ok(enrich_invoice(invoice, &self.supplier_repo, &self.material_repo).await)
    }
}
