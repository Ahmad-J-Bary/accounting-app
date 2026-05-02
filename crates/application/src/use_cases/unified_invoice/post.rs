use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use domain::sales::unified_invoice::{InvoiceType};
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::{InvoiceId};
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::category_repository::CategoryRepository;
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::{Currency, Money};
use rust_decimal::Decimal;
use crate::dto::invoice_dto::{InvoiceDto};
use crate::errors::AppError;

pub struct PostInvoiceUseCase {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    category_repo: Arc<dyn CategoryRepository>,
}

impl PostInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        category_repo: Arc<dyn CategoryRepository>,
    ) -> Self {
        Self { repo, movement_repo, journal_repo, account_repo, customer_repo, supplier_repo, material_repo, category_repo }
    }

    pub async fn execute(&self, id: String) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let mut invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        invoice.post().map_err(|e| AppError::Invalid(e.to_string()))?;

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
                line.unit_price.amount(),
                line.line_total().amount(),
                invoice.invoice_number.clone(),
                format!("{:?} بموجب فاتورة رقم {}", invoice.invoice_type, invoice.invoice_number),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.movement_repo.save(&movement).await?;
        }

        self.repo.update(&invoice).await?;

        // --- Accounting Logic ---
        let mut journal_lines = Vec::new();
        let total_amount = invoice.total_amount.amount();
        let amount_paid = invoice.amount_paid.amount();
        let amount_deferred = total_amount - amount_paid;

        // 1. Determine Revenue/Expense Account and Partner Account
        let (main_account_code, _partner_account_id) = match invoice.invoice_type {
            InvoiceType::Sales => {
                ("311", ()) // 311 is Sales Revenue (Cash Sales)
            },
            InvoiceType::Purchase => {
                ("41", ()) // 41 is Purchases
            },
            InvoiceType::OpeningBalance => {
                ("33", ()) // 33 is Opening Balance Equity
            }
        };

        let main_account = self.account_repo.find_by_code(main_account_code).await?.ok_or_else(|| AppError::NotFound(format!("حساب الإيرادات/المصاريف غير موجود: {}", main_account_code)))?;
        let cash_account = self.account_repo.find_by_code("122").await?.ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود: 122".into()))?;

        if invoice.invoice_type == InvoiceType::Sales {
            // Sales: Credit Revenue, Debit Cash/Customer
            journal_lines.push(JournalLine::new(main_account.id, Currency::SYP, Decimal::ONE, Money::zero(), Money::syp(total_amount), format!("إثبات مبيعات فاتورة رقم {}", invoice.invoice_number)));
            
            if amount_paid > Decimal::ZERO {
                journal_lines.push(JournalLine::new(cash_account.id, Currency::SYP, Decimal::ONE, Money::syp(amount_paid), Money::zero(), format!("دفعة نقدية - فاتورة رقم {}", invoice.invoice_number)));
            }
            
            if amount_deferred > Decimal::ZERO {
                if let Some(cid) = &invoice.customer_id {
                    if let Some(customer) = self.customer_repo.find_by_id(cid).await? {
                        if let Some(p_acc_id) = customer.account_id {
                            journal_lines.push(JournalLine::new(p_acc_id, Currency::SYP, Decimal::ONE, Money::syp(amount_deferred), Money::zero(), format!("ذمة مدينة - فاتورة رقم {}", invoice.invoice_number)));
                            
                            // Update customer balance in subledger
                            let mut updated_customer = customer;
                            updated_customer.increase_debit(amount_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                            self.customer_repo.update(&updated_customer).await?;
                        }
                    }
                }
            }
        } else if invoice.invoice_type == InvoiceType::Purchase {
            // Purchase: Debit Expense, Credit Cash/Supplier
            journal_lines.push(JournalLine::new(main_account.id, Currency::SYP, Decimal::ONE, Money::syp(total_amount), Money::zero(), format!("إثبات مشتريات فاتورة رقم {}", invoice.invoice_number)));
            
            if amount_paid > Decimal::ZERO {
                journal_lines.push(JournalLine::new(cash_account.id, Currency::SYP, Decimal::ONE, Money::zero(), Money::syp(amount_paid), format!("دفعة نقدية - فاتورة رقم {}", invoice.invoice_number)));
            }
            
            if amount_deferred > Decimal::ZERO {
                if let Some(sid) = &invoice.supplier_id {
                    if let Some(supplier) = self.supplier_repo.find_by_id(sid).await? {
                        if let Some(p_acc_id) = supplier.account_id {
                            journal_lines.push(JournalLine::new(p_acc_id, Currency::SYP, Decimal::ONE, Money::zero(), Money::syp(amount_deferred), format!("ذمة دائنة - فاتورة رقم {}", invoice.invoice_number)));
                            
                            // Update supplier balance in subledger
                            let mut updated_supplier = supplier;
                            updated_supplier.increase_credit(amount_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                            self.supplier_repo.update(&updated_supplier).await?;
                        }
                    }
                }
            }
        } else if invoice.invoice_type == InvoiceType::OpeningBalance {
            // Opening Balance (Inventory): Debit Inventory, Credit Equity
            if let Some(inv_account) = self.account_repo.find_by_code("124").await? {
                journal_lines.push(JournalLine::new(inv_account.id, Currency::SYP, Decimal::ONE, Money::syp(total_amount), Money::zero(), format!("بضاعة أول المدة - فاتورة رقم {}", invoice.invoice_number)));
                journal_lines.push(JournalLine::new(main_account.id, Currency::SYP, Decimal::ONE, Money::zero(), Money::syp(total_amount), format!("رصيد افتتاح لليومية - فاتورة رقم {}", invoice.invoice_number)));
            }
        }

        if !journal_lines.is_empty() {
            let mut journal_entry = JournalEntry::new(
                format!("INV-JE-{}", invoice.invoice_number),
                journal_lines,
                Utc::now(),
                format!("قيد آلي ناتج عن فاتورة رقم {}", invoice.invoice_number),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            
            // Automatically post the journal entry
            journal_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            
            self.journal_repo.save(&journal_entry).await?;
        }

        let dto = InvoiceDto::from(invoice);
        let queries = crate::use_cases::unified_invoice::InvoiceQueries::new(
            self.repo.clone(),
            self.material_repo.clone(),
            self.customer_repo.clone(),
            self.supplier_repo.clone(),
            self.category_repo.clone(),
        );
        queries.populate_dto(dto).await
    }
}
