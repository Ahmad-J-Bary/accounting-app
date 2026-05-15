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
use domain::shared::{Currency, Money, MonetaryAmount};
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

pub struct PostInvoiceDependencies {
    pub repo: Arc<dyn UnifiedInvoiceRepository>,
    pub movement_repo: Arc<dyn StockMovementRepository>,
    pub journal_repo: Arc<dyn JournalEntryRepository>,
    pub account_repo: Arc<dyn AccountRepository>,
    pub customer_repo: Arc<dyn CustomerRepository>,
    pub supplier_repo: Arc<dyn SupplierRepository>,
    pub material_repo: Arc<dyn MaterialRepository>,
    pub category_repo: Arc<dyn CategoryRepository>,
}

impl PostInvoiceUseCase {
    pub fn new(deps: PostInvoiceDependencies) -> Self {
        Self {
            repo: deps.repo,
            movement_repo: deps.movement_repo,
            journal_repo: deps.journal_repo,
            account_repo: deps.account_repo,
            customer_repo: deps.customer_repo,
            supplier_repo: deps.supplier_repo,
            material_repo: deps.material_repo,
            category_repo: deps.category_repo,
        }
    }

    pub async fn execute(&self, id: String) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let mut invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        // If already posted, we need to reverse existing impact before re-posting
        if invoice.status == domain::sales::unified_invoice::InvoiceStatus::Posted {
             let reopener = crate::use_cases::unified_invoice::ReopenInvoiceUseCase::new(
                self.repo.clone(),
                self.movement_repo.clone(),
                self.journal_repo.clone(),
                self.customer_repo.clone(),
                self.supplier_repo.clone(),
            );
            reopener.execute(id.clone()).await?;
            
            // Re-fetch to get clean state
            invoice = self.repo.find_by_id(&invoice_id).await?
                .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة بعد التراجع".into()))?;
        }

        invoice.post().map_err(|e| AppError::Invalid(e.to_string()))?;

        let movement_type = match invoice.invoice_type {
            InvoiceType::Sales => MovementType::Sale,
            InvoiceType::Purchase => MovementType::Purchase,
            InvoiceType::PurchaseCosts => MovementType::Purchase, 
            InvoiceType::OpeningBalance => MovementType::OpeningBalance,
        };

        for line in &invoice.lines {
            let conversion_factor = line.conversion_factor.unwrap_or(Decimal::ONE);
            let effective_quantity = line.quantity * conversion_factor;
            
            let unit_cost = line.unit_price.amount();
            let total_cost = line.line_total().amount();

            let movement = StockMovement::new(
                line.material_id,
                movement_type.clone(),
                effective_quantity,
                unit_cost,
                total_cost,
                invoice.invoice_number.clone(),
                format!("{:?} بموجب فاتورة رقم {} ({} x {})", invoice.invoice_type, invoice.invoice_number, line.quantity, conversion_factor),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.movement_repo.save(&movement).await?;
        }

        self.repo.update(&invoice).await?;

        // --- Accounting Logic ---
        let mut journal_lines = Vec::new();
        let doc_currency = Currency::from_code(&invoice.currency_code);
        let fx_rate = invoice.exchange_rate;

        let total_amount = invoice.total_amount.amount();
        let amount_paid = invoice.amount_paid.amount();
        let amount_deferred = total_amount - amount_paid;

        let (main_account_code, _) = match invoice.invoice_type {
            InvoiceType::Sales => ("311", ()),
            InvoiceType::Purchase => ("41", ()),
            InvoiceType::PurchaseCosts => ("4101", ()),
            InvoiceType::OpeningBalance => ("33", ()),
        };

        let main_account = self.account_repo.find_by_code(main_account_code).await?.ok_or_else(|| AppError::NotFound(format!("حساب الإيرادات/المصاريف غير موجود: {}", main_account_code)))?;
        let cash_account = self.account_repo.find_by_code("122").await?.ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود: 122".into()))?;

        if total_amount > Decimal::ZERO {
            if invoice.invoice_type == InvoiceType::Sales {
                journal_lines.push(JournalLine::new(
                    main_account.id, 
                    MonetaryAmount::zero(doc_currency.clone()), 
                    MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                    format!("إثبات مبيعات فاتورة رقم {}", invoice.invoice_number)
                ));
                
                if amount_paid > Decimal::ZERO {
                    journal_lines.push(JournalLine::new(
                        cash_account.id, 
                        MonetaryAmount::new(Money::new(amount_paid, doc_currency.clone()), fx_rate), 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        format!("دفعة نقدية - فاتورة رقم {}", invoice.invoice_number)
                    ));
                }
                
                if amount_deferred > Decimal::ZERO {
                    let mut deferred_handled = false;
                    if let Some(cid) = &invoice.customer_id {
                        if let Some(customer) = self.customer_repo.find_by_id(cid).await? {
                            if let Some(p_acc_id) = customer.account_id {
                                journal_lines.push(JournalLine::new(
                                    p_acc_id, 
                                    MonetaryAmount::new(Money::new(amount_deferred, doc_currency.clone()), fx_rate), 
                                    MonetaryAmount::zero(doc_currency.clone()), 
                                    format!("ذمة مدينة - فاتورة رقم {}", invoice.invoice_number)
                                ).with_partner(cid.0));
                                
                                let mut updated_customer = customer;
                                updated_customer.increase_debit(amount_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                                self.customer_repo.update(&updated_customer).await?;
                                deferred_handled = true;
                            }
                        }
                    }
                    if !deferred_handled {
                        journal_lines.push(JournalLine::new(
                            cash_account.id, 
                            MonetaryAmount::new(Money::new(amount_deferred, doc_currency.clone()), fx_rate), 
                            MonetaryAmount::zero(doc_currency.clone()), 
                            format!("ذمة نقدية (المبلغ المتبقي) - فاتورة رقم {}", invoice.invoice_number)
                        ));
                    }
                }
            } else if invoice.invoice_type == InvoiceType::Purchase || invoice.invoice_type == InvoiceType::PurchaseCosts {
                let desc = if invoice.invoice_type == InvoiceType::PurchaseCosts {
                    format!("إثبات تكاليف إضافية للمشتريات - فاتورة رقم {}", invoice.invoice_number)
                } else {
                    format!("إثبات مشتريات فاتورة رقم {}", invoice.invoice_number)
                };

                journal_lines.push(JournalLine::new(
                    main_account.id, 
                    MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                    MonetaryAmount::zero(doc_currency.clone()), 
                    desc
                ));
                
                if amount_paid > Decimal::ZERO {
                    journal_lines.push(JournalLine::new(
                        cash_account.id, 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        MonetaryAmount::new(Money::new(amount_paid, doc_currency.clone()), fx_rate), 
                        format!("دفعة نقدية - فاتورة رقم {}", invoice.invoice_number)
                    ));
                }
                
                if amount_deferred > Decimal::ZERO {
                    let mut deferred_handled = false;
                    if let Some(sid) = &invoice.supplier_id {
                        if let Some(supplier) = self.supplier_repo.find_by_id(sid).await? {
                            if let Some(p_acc_id) = supplier.account_id {
                                journal_lines.push(JournalLine::new(
                                    p_acc_id, 
                                    MonetaryAmount::zero(doc_currency.clone()), 
                                    MonetaryAmount::new(Money::new(amount_deferred, doc_currency.clone()), fx_rate), 
                                    format!("ذمة دائنة - فاتورة رقم {}", invoice.invoice_number)
                                ).with_partner(sid.0));
                                
                                let mut updated_supplier = supplier;
                                updated_supplier.increase_credit(amount_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                                self.supplier_repo.update(&updated_supplier).await?;
                                deferred_handled = true;
                            }
                        }
                    }
                    // Fallback: if no supplier account, credit cash to balance the journal
                    if !deferred_handled {
                        journal_lines.push(JournalLine::new(
                            cash_account.id, 
                            MonetaryAmount::zero(doc_currency.clone()), 
                            MonetaryAmount::new(Money::new(amount_deferred, doc_currency.clone()), fx_rate), 
                            format!("ذمة نقدية (المبلغ المتبقي) - فاتورة رقم {}", invoice.invoice_number)
                        ));
                    }
                }
            } else if invoice.invoice_type == InvoiceType::OpeningBalance {
                let inv_account_opt = self.account_repo.find_by_code("124").await?;
                if let Some(inv_account) = inv_account_opt {
                    journal_lines.push(JournalLine::new(
                        inv_account.id, 
                        MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        format!("بضاعة أول المدة - فاتورة رقم {}", invoice.invoice_number)
                    ));
                    journal_lines.push(JournalLine::new(
                        main_account.id, 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                        format!("رصيد افتتاحي لليومية - فاتورة رقم {}", invoice.invoice_number)
                    ));
                }
            }
        }

        if !journal_lines.is_empty() {
            let journal_type = match invoice.invoice_type {
                InvoiceType::Sales => {
                    if amount_deferred > Decimal::ZERO { domain::accounting::JournalType::CreditSalesJournal }
                    else { domain::accounting::JournalType::CashSalesJournal }
                },
                InvoiceType::Purchase => domain::accounting::JournalType::PurchaseJournal,
                InvoiceType::PurchaseCosts => domain::accounting::JournalType::PurchaseCostsJournal,
                InvoiceType::OpeningBalance => domain::accounting::JournalType::AccountOpeningBalance,
            };

            let mut journal_entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                journal_type,
                journal_lines,
                Utc::now(),
                format!("قيد آلي ناتج عن فاتورة رقم {}", invoice.invoice_number),
                Some(invoice.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            
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