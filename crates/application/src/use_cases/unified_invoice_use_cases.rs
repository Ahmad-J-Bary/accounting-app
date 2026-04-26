use std::sync::Arc;
use domain::sales::unified_invoice::{UnifiedInvoice, InvoiceType};
use domain::sales::invoice_line::InvoiceLine;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{InvoiceId, MaterialId, CustomerId, SupplierId};
use domain::shared::money::Money;
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::category_repository::CategoryRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;
use chrono::Utc;

pub struct UnifiedInvoiceUseCases {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    category_repo: Arc<dyn CategoryRepository>,
    _journal_repo: Arc<dyn JournalEntryRepository>,
}

impl UnifiedInvoiceUseCases {
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        category_repo: Arc<dyn CategoryRepository>,
        _journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            repo,
            material_repo,
            movement_repo,
            customer_repo,
            supplier_repo,
            category_repo,
            _journal_repo,
        }
    }

    pub async fn create(&self, req: CreateInvoiceRequest) -> Result<InvoiceDto, AppError> {
        let invoice_type = match req.invoice_type.as_str() {
            "Sales" => InvoiceType::Sales,
            "Purchase" => InvoiceType::Purchase,
            "OpeningBalance" => InvoiceType::OpeningBalance,
            _ => return Err(AppError::Invalid("نوع فاتورة غير صالح".into())),
        };

        let customer_id = req.customer_id.map(|id| CustomerId::from_str(&id).unwrap());
        let supplier_id = req.supplier_id.map(|id| SupplierId::from_str(&id).unwrap());
        let issued_at = chrono::DateTime::parse_from_rfc3339(&req.issued_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let mut invoice = UnifiedInvoice::new(
            req.invoice_number,
            invoice_type,
            customer_id,
            supplier_id,
            issued_at,
            req.notes,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        for line_dto in req.lines {
            let material_id = MaterialId::from_str(&line_dto.material_id)
                .map_err(|_| AppError::Invalid("معرف مادة غير صالح".into()))?;
            
            let quantity = Decimal::from_str(&line_dto.quantity)
                .map_err(|_| AppError::Invalid("كمية غير صالحة".into()))?;
            
            let unit_price = Money::syp(Decimal::from_str(&line_dto.unit_price)
                .map_err(|_| AppError::Invalid("سعر غير صالح".into()))?);

            let purchase_price = line_dto.purchase_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let retail_price = line_dto.retail_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let wholesale_price = line_dto.wholesale_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let semi_wholesale_price = line_dto.semi_wholesale_price.and_then(|s| Decimal::from_str(&s).ok().map(Money::syp));
            let minimum_stock = line_dto.minimum_stock.and_then(|s| Decimal::from_str(&s).ok());

            let line = InvoiceLine::new(
                material_id,
                quantity,
                unit_price,
                purchase_price,
                retail_price,
                wholesale_price,
                semi_wholesale_price,
                minimum_stock,
                line_dto.notes,
            );
            invoice.add_line(line).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        invoice.tax_amount = Money::syp(Decimal::from_str(&req.tax_amount).unwrap_or(Decimal::ZERO));
        invoice.discount_amount = Money::syp(Decimal::from_str(&req.discount_amount).unwrap_or(Decimal::ZERO));
        invoice.recalculate_totals();

        self.repo.save(&invoice).await?;
        Ok(InvoiceDto::from(invoice))
    }

    pub async fn post(&self, id: String) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let mut invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        invoice.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        // 1. Record Stock Movements
        let movement_type = match invoice.invoice_type {
            InvoiceType::Sales => MovementType::Sale,
            InvoiceType::Purchase => MovementType::Purchase,
            InvoiceType::OpeningBalance => MovementType::OpeningBalance,
        };

        for line in &invoice.lines {
            let movement = StockMovement::new(
                line.material_id.clone(),
                movement_type.clone(),
                line.quantity,
                invoice.invoice_number.clone(),
                format!("{:?} بموجب فاتورة رقم {}", invoice.invoice_type, invoice.invoice_number),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.movement_repo.save(&movement).await?;
        }

        // 2. TODO: Record Journal Entries
        // This requires mapping to accounts. We'll implement a basic version or leave as TODO for now
        // based on the user's detailed accounting requirements.

        self.repo.update(&invoice).await?;
        Ok(InvoiceDto::from(invoice))
    }

    pub async fn list_by_type(&self, invoice_type: String) -> Result<Vec<InvoiceDto>, AppError> {
        let itype = match invoice_type.as_str() {
            "Sales" => InvoiceType::Sales,
            "Purchase" => InvoiceType::Purchase,
            "OpeningBalance" => InvoiceType::OpeningBalance,
            _ => return Err(AppError::Invalid("نوع فاتورة غير صالح".into())),
        };

        let invoices = self.repo.list_by_type(itype).await?;
        Ok(invoices.into_iter().map(InvoiceDto::from).collect())
    }

    pub async fn get_by_id(&self, id: String) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;
        
        let mut dto = InvoiceDto::from(invoice);
        
        // Enrich with names
        if let Some(ref cid) = dto.customer_id {
             if let Ok(id) = CustomerId::from_str(cid) {
                 if let Ok(Some(customer)) = self.customer_repo.find_by_id(&id).await {
                     dto.customer_name = Some(customer.name);
                 }
             }
        }
        if let Some(ref sid) = dto.supplier_id {
             if let Ok(id) = SupplierId::from_str(sid) {
                 if let Ok(Some(supplier)) = self.supplier_repo.find_by_id(&id).await {
                     dto.supplier_name = Some(supplier.name);
                 }
             }
        }

        for line in &mut dto.lines {
            if let Ok(mid) = MaterialId::from_str(&line.material_id) {
                if let Ok(Some(material)) = self.material_repo.find_by_id(&mid).await {
                    line.material_name = Some(material.name);
                    line.barcode = Some(material.barcode);
                    line.code = Some(material.code);
                    // Get first category name as sample
                    if let Some(cid) = material.category_ids.first() {
                         if let Ok(Some(cat)) = self.category_repo.find_by_id(cid).await {
                             line.category_name = Some(cat.name);
                         }
                    }
                }
            }
        }

        Ok(dto)
    }

    pub async fn list_all(&self) -> Result<Vec<InvoiceDto>, AppError> {
        let invoices = self.repo.list_all().await?;
        Ok(invoices.into_iter().map(InvoiceDto::from).collect())
    }
}
