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
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
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
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
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
    pub currency_repo: Arc<dyn CurrencyRepository>,
    pub exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
}

fn allocate_extra_cost(
    line_total: Decimal,
    subtotal: Decimal,
    total_extra: Decimal,
    remaining_extra: &mut Decimal,
    is_last_line: bool,
) -> Decimal {
    if total_extra <= Decimal::ZERO || subtotal <= Decimal::ZERO {
        return Decimal::ZERO;
    }

    if is_last_line {
        let allocated = *remaining_extra;
        *remaining_extra = Decimal::ZERO;
        return allocated;
    }

    let allocated = (total_extra * line_total) / subtotal;
    *remaining_extra -= allocated;
    allocated
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
            currency_repo: deps.currency_repo,
            exchange_rate_repo: deps.exchange_rate_repo,
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
                self.currency_repo.clone(),
                self.exchange_rate_repo.clone(),
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

        let purchase_subtotal = invoice.subtotal();
        let purchase_subtotal_doc = purchase_subtotal.amount();
        let purchase_subtotal_base = purchase_subtotal.base_amount;
        let purchase_extra_doc = invoice.extra_costs.amount();
        let purchase_extra_base = invoice.extra_costs.base_amount;
        let mut remaining_extra_doc = purchase_extra_doc;
        let mut remaining_extra_base = purchase_extra_base;

        for (index, line) in invoice.lines.iter().enumerate() {
            let conversion_factor = line.conversion_factor.unwrap_or(Decimal::ONE);
            let effective_quantity = line.quantity * conversion_factor;
            
            let line_total = line.line_total();
            let mut total_cost = line_total.amount();
            let mut total_cost_base = line_total.base_amount;

            if invoice.invoice_type == InvoiceType::Purchase {
                let is_last_line = index + 1 == invoice.lines.len();
                total_cost += allocate_extra_cost(
                    line_total.amount(),
                    purchase_subtotal_doc,
                    purchase_extra_doc,
                    &mut remaining_extra_doc,
                    is_last_line,
                );
                total_cost_base += allocate_extra_cost(
                    line_total.base_amount,
                    purchase_subtotal_base,
                    purchase_extra_base,
                    &mut remaining_extra_base,
                    is_last_line,
                );
            } else if invoice.invoice_type == InvoiceType::Sales {
                // For Sales invoices, the stock movement cost must reflect the
                // INVENTORY COST (average cost), NOT the sale price.
                // This is critical for correct Ending Inventory calculation in Income Statement.
                let summary = self.movement_repo.get_material_summary(&line.material_id).await
                    .unwrap_or_else(|_| crate::ports::stock_movement_repository::MaterialInventorySummary {
                        total_received: Decimal::ZERO,
                        total_sold: Decimal::ZERO,
                        total_available: Decimal::ZERO,
                        total_damaged: Decimal::ZERO,
                        last_purchase_price: Decimal::ZERO,
                        last_purchase_price_base: Decimal::ZERO,
                        last_sale_price: Decimal::ZERO,
                        last_sale_price_base: Decimal::ZERO,
                        average_cost: Decimal::ZERO,
                        average_cost_base: Decimal::ZERO,
                    });
                let avg_unit_cost_base = summary.average_cost_base;
                let avg_unit_cost = summary.average_cost;
                total_cost = avg_unit_cost * effective_quantity;
                total_cost_base = avg_unit_cost_base * effective_quantity;
            }

            let unit_cost = if effective_quantity > Decimal::ZERO {
                total_cost / effective_quantity
            } else {
                Decimal::ZERO
            };
            let unit_cost_base = if effective_quantity > Decimal::ZERO {
                total_cost_base / effective_quantity
            } else {
                Decimal::ZERO
            };

            let mut movement = StockMovement::new(
                line.material_id,
                movement_type.clone(),
                effective_quantity,
                unit_cost,
                total_cost,
                invoice.invoice_number.clone(),
                format!("{:?} بموجب فاتورة رقم {} ({} x {})", invoice.invoice_type, invoice.invoice_number, line.quantity, conversion_factor),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.unit_cost = unit_cost;
            movement.unit_cost_base = unit_cost_base;
            movement.total_cost = total_cost;
            movement.total_cost_base = total_cost_base;
            movement.original_currency = Some(invoice.currency_code.clone());
            movement.fx_rate = invoice.exchange_rate;
            self.movement_repo.save(&movement).await?;
        }

        self.repo.update(&invoice).await?;

        // --- Accounting Logic ---
        let mut journal_lines = Vec::new();
        let doc_currency = Currency::new(&invoice.currency_code, &invoice.currency_code, &invoice.currency_code, "", 2, false);
        let fx_rate = invoice.exchange_rate;

        let total_amount = invoice.total_amount.amount();
        let amount_paid = invoice.amount_paid.amount();
        let amount_deferred = total_amount - amount_paid;

        let (main_account_code, _) = match invoice.invoice_type {
            InvoiceType::Sales => ("311", ()),
            InvoiceType::Purchase => ("41", ()),
            InvoiceType::PurchaseCosts => ("41", ()),
            InvoiceType::OpeningBalance => ("33", ()),
        };

        let main_account = self.account_repo.find_by_code(main_account_code).await?.ok_or_else(|| AppError::NotFound(format!("حساب الإيرادات/المصاريف غير موجود: {}", main_account_code)))?;
        let cash_account = self.account_repo.find_by_code("122").await?.ok_or_else(|| AppError::NotFound("حساب الصندوق غير موجود: 122".into()))?;

        if total_amount > Decimal::ZERO {
            if invoice.invoice_type == InvoiceType::Sales {
                let sales_account = if amount_deferred > Decimal::ZERO {
                    self.account_repo.find_by_code("312").await?
                        .ok_or_else(|| AppError::NotFound("حساب المبيعات الآجلة غير موجود: 312".into()))?
                } else {
                    main_account.clone()
                };

                let mut customer_handled = false;
                if let Some(cid) = &invoice.customer_id {
                    if let Some(customer) = self.customer_repo.find_by_id(cid).await? {
                        if let Some(p_acc_id) = customer.account_id {
                            journal_lines.push(JournalLine::new(
                                p_acc_id,
                                MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate),
                                MonetaryAmount::zero(doc_currency.clone()),
                                format!("فاتورة مبيعات رقم {}", invoice.invoice_number)
                            ).with_partner(cid.0));

                            let converted_total = convert_to_partner_currency(
                                total_amount,
                                &invoice.currency_code,
                                fx_rate,
                                &customer.currency.code,
                                &self.currency_repo,
                                &self.exchange_rate_repo,
                            ).await?;
                            let mut updated_customer = customer;
                            updated_customer.increase_debit(converted_total).map_err(|e| AppError::Invalid(e.to_string()))?;
                            self.customer_repo.update(&updated_customer).await?;
                            customer_handled = true;
                        }
                    }
                }
                if !customer_handled {
                    journal_lines.push(JournalLine::new(
                        cash_account.id,
                        MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate),
                        MonetaryAmount::zero(doc_currency.clone()),
                        format!("ذمة نقدية (زبون غير مسجل) - فاتورة رقم {}", invoice.invoice_number)
                    ));
                }

                journal_lines.push(JournalLine::new(
                    sales_account.id,
                    MonetaryAmount::zero(doc_currency.clone()),
                    MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate),
                    format!("إثبات مبيعات فاتورة رقم {}", invoice.invoice_number)
                ));
            } else if invoice.invoice_type == InvoiceType::Purchase {
                let extra_costs_val = invoice.extra_costs.amount();
                let main_debit_amount = total_amount - extra_costs_val;

                journal_lines.push(JournalLine::new(
                    main_account.id, 
                    MonetaryAmount::new(Money::new(main_debit_amount, doc_currency.clone()), fx_rate), 
                    MonetaryAmount::zero(doc_currency.clone()), 
                    format!("إنشاء فاتورة المشتريات رقم {}", invoice.invoice_number)
                ));

                let mut purchase_supplier = None;
                if let Some(sid) = &invoice.supplier_id {
                    purchase_supplier = self.supplier_repo.find_by_id(sid).await?;
                }

                if let Some(ref supplier) = purchase_supplier {
                    if let Some(p_acc_id) = supplier.account_id {
                        if let Some(supplier_id) = &invoice.supplier_id {
                            journal_lines.push(JournalLine::new(
                                p_acc_id, 
                                MonetaryAmount::zero(doc_currency.clone()), 
                                MonetaryAmount::new(Money::new(main_debit_amount, doc_currency.clone()), fx_rate), 
                                format!("ذمة دائنة - فاتورة رقم {}", invoice.invoice_number)
                            ).with_partner(supplier_id.0));
                        }

                        let converted_debit = convert_to_partner_currency(
                            main_debit_amount,
                            &invoice.currency_code,
                            fx_rate,
                            &supplier.currency.code,
                            &self.currency_repo,
                            &self.exchange_rate_repo,
                        ).await?;
                        let mut updated_supplier = supplier.clone();
                        updated_supplier.increase_credit(converted_debit).map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.supplier_repo.update(&updated_supplier).await?;
                    }
                } else {
                    journal_lines.push(JournalLine::new(
                        cash_account.id, 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        MonetaryAmount::new(Money::new(main_debit_amount, doc_currency.clone()), fx_rate), 
                        format!("ذمة نقدية - فاتورة رقم {}", invoice.invoice_number)
                    ));
                }
            } else if invoice.invoice_type == InvoiceType::PurchaseCosts {
                journal_lines.push(JournalLine::new(
                    main_account.id, 
                    MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                    MonetaryAmount::zero(doc_currency.clone()), 
                    format!("تكاليف إضافية مرتبطة بفاتورة المشتريات رقم {}", invoice.invoice_number)
                ));

                if let Some(sid) = &invoice.supplier_id {
                    if let Some(supplier) = self.supplier_repo.find_by_id(sid).await? {
                        if let Some(p_acc_id) = supplier.account_id {
                            journal_lines.push(JournalLine::new(
                                p_acc_id, 
                                MonetaryAmount::zero(doc_currency.clone()), 
                                MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                                format!("ذمة دائنة (تكاليف) - فاتورة رقم {}", invoice.invoice_number)
                            ).with_partner(sid.0));
                        }
                    }
                } else {
                    journal_lines.push(JournalLine::new(
                        cash_account.id, 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                        format!("ذمة نقدية (تكاليف) - فاتورة رقم {}", invoice.invoice_number)
                    ));
                }
            } else if invoice.invoice_type == InvoiceType::OpeningBalance {
                let inv_account_opt = self.account_repo.find_by_code("124").await?;
                if let Some(inv_account) = inv_account_opt {
                    journal_lines.push(JournalLine::new(
                        inv_account.id, 
                        MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        format!("إنشاء فاتورة أول المدة رقم {}", invoice.invoice_number)
                    ));
                    journal_lines.push(JournalLine::new(
                        main_account.id, 
                        MonetaryAmount::zero(doc_currency.clone()), 
                        MonetaryAmount::new(Money::new(total_amount, doc_currency.clone()), fx_rate), 
                        format!("إنشاء فاتورة أول المدة رقم {}", invoice.invoice_number)
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
                InvoiceType::OpeningBalance => domain::accounting::JournalType::MaterialOpeningBalance,
            };

            let mut journal_entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                journal_type,
                journal_lines,
                Utc::now(),
                match invoice.invoice_type {
                    InvoiceType::OpeningBalance => format!("إنشاء فاتورة أول المدة رقم {}", invoice.invoice_number),
                    InvoiceType::PurchaseCosts => format!("تكاليف إضافية مرتبطة بفاتورة المشتريات رقم {}", invoice.invoice_number),
                    InvoiceType::Purchase => format!("إنشاء فاتورة المشتريات رقم {}", invoice.invoice_number),
                    _ => format!("قيد آلي ناتج عن فاتورة رقم {}", invoice.invoice_number),
                },
                Some(invoice.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            
            journal_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&journal_entry).await?;
        }

        let extra_costs_val = invoice.extra_costs.amount();
        if invoice.invoice_type == InvoiceType::Purchase && extra_costs_val > Decimal::ZERO {
            let desc = format!("تكاليف إضافية مرتبطة بفاتورة المشتريات رقم {}", invoice.invoice_number);

            // PurchaseCostsJournal always credits CASH — supplier has no relationship with extra costs
            let extra_lines = vec![
                JournalLine::new(
                    main_account.id, 
                    MonetaryAmount::new(Money::new(extra_costs_val, doc_currency.clone()), fx_rate), 
                    MonetaryAmount::zero(doc_currency.clone()), 
                    desc.clone()
                ),
                JournalLine::new(
                    cash_account.id,
                    MonetaryAmount::zero(doc_currency.clone()),
                    MonetaryAmount::new(Money::new(extra_costs_val, doc_currency.clone()), fx_rate),
                    format!("تكاليف إضافية - فاتورة رقم {}", invoice.invoice_number)
                ),
            ];

            let mut extra_entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                domain::accounting::JournalType::PurchaseCostsJournal,
                extra_lines,
                Utc::now(),
                desc,
                Some(invoice.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            
            extra_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&extra_entry).await?;
        }

        // --- Create separate CashReceipt entry for sales payments received ---
        if invoice.invoice_type == InvoiceType::Sales && amount_paid > Decimal::ZERO {
            let mut receipt_lines = Vec::new();
            receipt_lines.push(JournalLine::new(
                cash_account.id,
                MonetaryAmount::new(Money::new(amount_paid, doc_currency.clone()), fx_rate),
                MonetaryAmount::zero(doc_currency.clone()),
                format!("تحصيل نقدي - فاتورة مبيعات رقم {}", invoice.invoice_number)
            ));

            let mut cust_acc_for_receipt = None;
            if let Some(cid) = &invoice.customer_id {
                cust_acc_for_receipt = self.customer_repo.find_by_id(cid).await?
                    .and_then(|c| c.account_id);
            }

            if let Some(cust_acc_id) = cust_acc_for_receipt {
                receipt_lines.push(JournalLine::new(
                    cust_acc_id,
                    MonetaryAmount::zero(doc_currency.clone()),
                    MonetaryAmount::new(Money::new(amount_paid, doc_currency.clone()), fx_rate),
                    format!("تحصيل نقدي - فاتورة مبيعات رقم {}", invoice.invoice_number)
                ).with_partner(invoice.customer_id.as_ref().unwrap().0));

                if let Some(cid) = &invoice.customer_id {
                    if let Some(mut customer) = self.customer_repo.find_by_id(cid).await? {
                        let converted_paid = convert_to_partner_currency(
                            amount_paid,
                            &invoice.currency_code,
                            fx_rate,
                            &customer.currency.code,
                            &self.currency_repo,
                            &self.exchange_rate_repo,
                        ).await?;
                        customer.decrease_debit(converted_paid).map_err(|e| AppError::Invalid(e.to_string()))?;
                        self.customer_repo.update(&customer).await?;
                    }
                }
            } else {
                receipt_lines.push(JournalLine::new(
                    cash_account.id,
                    MonetaryAmount::zero(doc_currency.clone()),
                    MonetaryAmount::new(Money::new(amount_paid, doc_currency.clone()), fx_rate),
                    format!("تحصيل نقدي (زبون غير مسجل) - فاتورة مبيعات رقم {}", invoice.invoice_number)
                ));
            }

            let mut receipt_entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                domain::accounting::JournalType::CashReceipt,
                receipt_lines,
                Utc::now(),
                format!("تحصيل نقدي بموجب فاتورة مبيعات رقم {}", invoice.invoice_number),
                Some(invoice.id.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;

            receipt_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&receipt_entry).await?;
        }

        // --- Create separate CashPayment entry for main amount's initial payment only ---
        let main_paid = if extra_costs_val > Decimal::ZERO {
            if amount_paid > extra_costs_val { amount_paid - extra_costs_val } else { Decimal::ZERO }
        } else {
            amount_paid
        };

        if invoice.invoice_type == InvoiceType::Purchase && main_paid > Decimal::ZERO {
            let mut cp_supplier = None;
            if let Some(sid) = &invoice.supplier_id {
                cp_supplier = self.supplier_repo.find_by_id(sid).await?;
            }

            if let Some(ref supplier) = cp_supplier {
                if let Some(p_acc_id) = supplier.account_id {
                    let mut cp_lines = Vec::new();
                    cp_lines.push(JournalLine::new(
                        p_acc_id,
                        MonetaryAmount::new(Money::new(main_paid, doc_currency.clone()), fx_rate),
                        MonetaryAmount::zero(doc_currency.clone()),
                        format!("دفعة أولى للمورد عند إنشاء فاتورة المشتريات رقم {}", invoice.invoice_number)
                    ).with_partner(invoice.supplier_id.as_ref().unwrap().0));
                    cp_lines.push(JournalLine::new(
                        cash_account.id,
                        MonetaryAmount::zero(doc_currency.clone()),
                        MonetaryAmount::new(Money::new(main_paid, doc_currency.clone()), fx_rate),
                        format!("دفعة أولى للمورد عند إنشاء فاتورة المشتريات رقم {}", invoice.invoice_number)
                    ));

                    let mut cp_entry = JournalEntry::new(
                        self.journal_repo.get_next_entry_number().await?,
                        domain::accounting::JournalType::CashPayment,
                        cp_lines,
                        Utc::now(),
                        format!("دفعة أولى للمورد عند إنشاء فاتورة المشتريات رقم {}", invoice.invoice_number),
                        Some(invoice.id.to_string()),
                    ).map_err(|e| AppError::Invalid(e.to_string()))?;

                    cp_entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.journal_repo.save(&cp_entry).await?;

                    let converted_main_paid = convert_to_partner_currency(
                        main_paid,
                        &invoice.currency_code,
                        fx_rate,
                        &supplier.currency.code,
                        &self.currency_repo,
                        &self.exchange_rate_repo,
                    ).await?;
                    let mut updated_supplier = supplier.clone();
                    updated_supplier.decrease_credit(converted_main_paid).map_err(|e| AppError::Invalid(e.to_string()))?;
                    self.supplier_repo.update(&updated_supplier).await?;
                }
            }
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

pub async fn convert_to_partner_currency(
    amount: Decimal,
    invoice_currency: &str,
    invoice_exchange_rate: Decimal,
    partner_currency: &str,
    currency_repo: &Arc<dyn CurrencyRepository>,
    exchange_rate_repo: &Arc<dyn ExchangeRateRepository>,
) -> Result<Decimal, AppError> {
    // If partner has no currency assigned, treat it as base currency
    if partner_currency.is_empty() {
        let base_currency = currency_repo
            .get_base_currency()
            .await?
            .ok_or_else(|| AppError::NotFound("العملة الأساسية غير معرفة".into()))?;
        if invoice_currency == base_currency.code || invoice_exchange_rate.is_zero() {
            return Ok(amount);
        }
        return Ok(amount / invoice_exchange_rate);
    }

    if invoice_currency == partner_currency {
        return Ok(amount);
    }

    let base_currency = currency_repo
        .get_base_currency()
        .await?
        .ok_or_else(|| AppError::NotFound("العملة الأساسية غير معرفة".into()))?;

    // Step 1: convert amount to base currency (divide by invoice exchange rate)
    let base_amount = if invoice_currency == base_currency.code || invoice_exchange_rate.is_zero() {
        amount
    } else {
        amount / invoice_exchange_rate
    };

    if partner_currency == base_currency.code {
        return Ok(base_amount);
    }

    // Step 2: convert base currency to partner currency (multiply by rate)
    let rate_opt = exchange_rate_repo
        .find_latest(&base_currency.code, partner_currency, domain::shared::exchange_rate::RateType::Middle)
        .await?;

    match rate_opt {
        Some(rate) => Ok(base_amount * rate.rate),
        None => Err(AppError::NotFound(format!(
            "لم يتم العثور على سعر صرف من {} إلى {}",
            base_currency.code, partner_currency
        ))),
    }
}
