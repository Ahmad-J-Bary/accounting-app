use std::sync::Arc;
use chrono::DateTime;
// Removed unused Decimal import
use domain::purchases::{PurchaseInvoice, PurchaseInvoiceItem};
use domain::shared::ids::{SupplierId, MaterialId, PurchaseInvoiceId, AccountId};
use crate::ports::purchase_invoice_repository::PurchaseInvoiceRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use domain::accounting::journal_entry::JournalEntry;
use domain::shared::{Currency, Money, MonetaryAmount};
use crate::dto::purchase_invoice_dto::{
    CreatePurchaseInvoiceRequest, PurchaseInvoiceDto, PurchaseInvoiceItemDto,
    PurchaseAdditionalCostDto,
};
use crate::errors::AppError;

async fn enrich_invoice(
    inv: PurchaseInvoice,
    supplier_repo: &Arc<dyn SupplierRepository>,
    material_repo: &Arc<dyn MaterialRepository>,
    account_repo: &Arc<dyn AccountRepository>,
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
            unit_id: i.unit_id.clone(),
            conversion_factor: i.conversion_factor.map(|c| c.to_string()),
            unit_price: i.unit_price.to_string(),
            line_total: i.line_total.to_string(),
            notes: i.notes.clone(),
        });
    }

    let mut additional_costs = Vec::new();
    for c in &inv.additional_costs {
        let mut account_name = None;
        if let Ok(Some(account)) = account_repo.find_by_id(&c.account_id).await {
            account_name = Some(account.name_ar);
        }
        additional_costs.push(PurchaseAdditionalCostDto {
            id: c.id.clone(),
            description: c.description.clone(),
            account_id: c.account_id.0.to_string(),
            account_name,
            amount: c.amount.to_string(),
        });
    }

    PurchaseInvoiceDto {
        id,
        invoice_number,
        supplier_id,
        supplier_name,
        items,
        additional_costs,
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
    account_repo: Arc<dyn AccountRepository>,
}

impl CreatePurchaseInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseInvoiceRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo, account_repo }
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
            let conversion_factor = item_req.conversion_factor.as_ref()
                .map(|c| crate::utils::parse_decimal(Some(c), "معامل التحويل"))
                .transpose()?;
                
            let item = PurchaseInvoiceItem::new(
                material_id, 
                quantity, 
                unit_price, 
                item_req.unit_id.clone(), 
                conversion_factor
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            invoice.add_item(item).map_err(|e| AppError::Invalid(e.to_string()))?;
        }

        if let Some(costs_req) = req.additional_costs {
            for cost_req in costs_req {
                let account_id: AccountId = cost_req.account_id.parse()
                    .map_err(|_| AppError::Invalid("معرف الحساب غير صالح".into()))?;
                let amount = crate::utils::parse_decimal(Some(&cost_req.amount), "مبلغ التكلفة الإضافية")?;
                let cost = domain::purchases::purchase_invoice::PurchaseAdditionalCost {
                    id: uuid::Uuid::new_v4().to_string(),
                    description: cost_req.description,
                    account_id,
                    amount,
                };
                invoice.add_additional_cost(cost).map_err(|e| AppError::Invalid(e.to_string()))?;
            }
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
        Ok(enrich_invoice(invoice, &self.supplier_repo, &self.material_repo, &self.account_repo).await)
    }
}

pub struct ListPurchaseInvoicesUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl ListPurchaseInvoicesUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseInvoiceRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo, account_repo }
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
            dtos.push(enrich_invoice(inv, &self.supplier_repo, &self.material_repo, &self.account_repo).await);
        }
        Ok(dtos)
    }
}

pub struct PostPurchaseInvoiceUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl PostPurchaseInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseInvoiceRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo, movement_repo, journal_repo, account_repo }
    }

    pub async fn execute(&self, invoice_id: String) -> Result<PurchaseInvoiceDto, AppError> {
        let pid = invoice_id.parse()
            .map_err(|_| AppError::NotFound("معرف الفاتورة غير صالح".into()))?;
        let mut invoice = self.repo.find_by_id(&pid).await?
            .ok_or_else(|| AppError::NotFound("فاتورة الشراء غير موجودة".into()))?;
        invoice.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        // 1. Update stock and record movements
        for item in &invoice.items {
            if let Ok(Some(material)) = self.material_repo.find_by_id(&item.material_id).await {
                // Calculate effective quantity in base units
                let effective_quantity = item.quantity * item.conversion_factor.unwrap_or(rust_decimal::Decimal::ONE);

                let auto_notes = format!("شراء بموجب فاتورة مشتريات رقم {}", invoice.invoice_number);
                let movement_notes = item.notes.clone()
                    .filter(|n| !n.trim().is_empty())
                    .or_else(|| {
                        invoice.notes.clone().filter(|n| !n.trim().is_empty())
                    })
                    .unwrap_or(auto_notes);
                let ref_no = self.movement_repo.get_next_inventory_reference().await?;
                let mut movement = StockMovement::new(
                    material.id,
                    MovementType::Purchase,
                    effective_quantity,
                    item.unit_price,
                    item.line_total,
                    ref_no,
                    movement_notes,
                    chrono::Utc::now(),
                ).map_err(|e| AppError::Invalid(e.to_string()))?;
                movement.document_number = Some(invoice.invoice_number.clone());
                self.movement_repo.save(&movement).await?;
            }
        }

        // 2. Accounting Integration: Create Journal Entry for Purchase
        let supplier = self.supplier_repo.find_by_id(&invoice.supplier_id).await?
            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;
        
        let supplier_account_id = supplier.account_id
            .ok_or_else(|| AppError::Invalid("المورد لا يملك حساباً محاسبياً".into()))?;

        // Purchase/Inventory account (Code 124 based on migrations)
        let purchase_account = self.account_repo.find_by_code("124").await?
            .ok_or_else(|| AppError::NotFound("حساب المخزون/المشتريات (124) غير موجود".into()))?;

        let currency = Currency::new(&invoice.currency_code, &invoice.currency_code, &invoice.currency_code, "", 2, false);

        // Calculate subtotal for the main purchase entry (excluding additional costs)
        let purchase_amount_ma = MonetaryAmount::new(
            Money::new(invoice.subtotal + invoice.tax_amount - invoice.discount_amount, currency.clone()),
            invoice.exchange_rate
        );

        let entry_num = self.journal_repo.get_next_entry_number().await?;
        let mut purchase_entry = JournalEntry::create_purchase_entry(
            entry_num,
            format!("شراء بموجب فاتورة رقم {}", invoice.invoice_number),
            invoice.invoice_date,
            purchase_account.id,
            supplier_account_id,
            supplier.id.0,
            purchase_amount_ma,
            invoice.id.to_string(),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        purchase_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
        self.journal_repo.save(&purchase_entry).await?;

        // 3. Accounting Integration: Create Journal Entries for Additional Costs
        for cost in invoice.additional_costs.iter() {
            let cost_amount_ma = MonetaryAmount::new(
                Money::new(cost.amount, currency.clone()),
                invoice.exchange_rate
            );

            let cost_num = self.journal_repo.get_next_entry_number().await?;
            let mut cost_entry = JournalEntry::create_purchase_costs_entry(
                cost_num,
                format!("{} - فاتورة رقم {}", cost.description, invoice.invoice_number),
                invoice.invoice_date,
                cost.account_id, // Debit (e.g. Inventory or Freight)
                supplier_account_id, // Credit (Supplier)
                Some(supplier.id.0),
                cost_amount_ma,
                invoice.id.to_string(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            cost_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&cost_entry).await?;
        }

        // 4. Save invoice
        self.repo.update(&invoice).await?;
        Ok(enrich_invoice(invoice, &self.supplier_repo, &self.material_repo, &self.account_repo).await)
    }
}

pub struct GetPurchaseInvoiceUseCase {
    repo: Arc<dyn PurchaseInvoiceRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl GetPurchaseInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn PurchaseInvoiceRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo, account_repo }
    }

    pub async fn execute(&self, id: &str) -> Result<PurchaseInvoiceDto, AppError> {
        let id: PurchaseInvoiceId = id.parse().map_err(|_| AppError::Invalid("معرف غير صالح".into()))?;
        let inv = self.repo.find_by_id(&id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;
        Ok(enrich_invoice(inv, &self.supplier_repo, &self.material_repo, &self.account_repo).await)
    }
}
