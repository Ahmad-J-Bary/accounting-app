use std::sync::Arc;
use std::str::FromStr;
use rust_decimal::Decimal;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use domain::sales::unified_invoice::{InvoiceType, InvoiceStatus};
use domain::shared::ids::{InvoiceId};
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::dto::invoice_dto::{InvoiceDto};
use crate::errors::AppError;

/// Compute the net supplier credit that was actually recorded during posting
/// for a Purchase invoice. This mirrors the logic in PostInvoiceUseCase exactly:
///   main_debit = total - extra_costs
///   main_paid  = if amount_paid > extra_costs { amount_paid - extra_costs } else { 0 }
///   net_credit = main_debit - main_paid  (clamped to >= 0)
fn purchase_net_supplier_credit(
    total: Decimal,
    extra_costs: Decimal,
    amount_paid: Decimal,
) -> Decimal {
    let main_debit = if total > extra_costs { total - extra_costs } else { Decimal::ZERO };
    let main_paid = if extra_costs > Decimal::ZERO {
        if amount_paid > extra_costs { amount_paid - extra_costs } else { Decimal::ZERO }
    } else {
        amount_paid
    };
    if main_debit > main_paid { main_debit - main_paid } else { Decimal::ZERO }
}

pub struct ReopenInvoiceUseCase {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl ReopenInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
        exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self {
            repo,
            movement_repo,
            journal_repo,
            customer_repo,
            supplier_repo,
            currency_repo,
            exchange_rate_repo,
        }
    }

    pub async fn execute(&self, id: String) -> Result<InvoiceDto, AppError> {
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let mut invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        if invoice.status != InvoiceStatus::Posted {
            return Err(AppError::Invalid("يمكن فقط إعادة فتح الفواتير المرحلة".into()));
        }

        let total = invoice.total_amount.amount();
        let amount_paid = invoice.amount_paid.amount();
        let extra_costs = invoice.extra_costs.amount();

        // 1. Reverse Party Balance (Subledger)
        // For Sales: net customer debit posted = total - amount_paid
        // For Purchase: net supplier credit posted = purchase_net_supplier_credit(...)
        //   (mirrors PostInvoiceUseCase logic which separates extra_costs from main invoice)
        match invoice.invoice_type {
            InvoiceType::Sales => {
                let sales_deferred = total - amount_paid;
                if sales_deferred > Decimal::ZERO {
                    if let Some(cid) = &invoice.customer_id {
                        if let Some(mut customer) = self.customer_repo.find_by_id(cid).await? {
                            let converted = super::post::convert_to_partner_currency(
                                sales_deferred,
                                &invoice.currency_code,
                                invoice.exchange_rate,
                                &customer.currency.code,
                                &self.currency_repo,
                                &self.exchange_rate_repo,
                            ).await?;
                            customer.decrease_debit(converted).map_err(|e| AppError::Invalid(e.to_string()))?;
                            self.customer_repo.update(&customer).await?;
                        }
                    }
                }
            },
            InvoiceType::Purchase => {
                let net_credit = purchase_net_supplier_credit(total, extra_costs, amount_paid);
                if net_credit > Decimal::ZERO {
                    if let Some(sid) = &invoice.supplier_id {
                        if let Some(mut supplier) = self.supplier_repo.find_by_id(sid).await? {
                            let converted = super::post::convert_to_partner_currency(
                                net_credit,
                                &invoice.currency_code,
                                invoice.exchange_rate,
                                &supplier.currency.code,
                                &self.currency_repo,
                                &self.exchange_rate_repo,
                            ).await?;
                            supplier.decrease_credit(converted).map_err(|e| AppError::Invalid(e.to_string()))?;
                            self.supplier_repo.update(&supplier).await?;
                        }
                    }
                }
            },
            _ => {}
        }

        // 2. Delete all journal entries linked to this invoice
        let entries = self.journal_repo.find_all_by_source_id(&invoice.id.to_string()).await?;
        for entry in entries {
            self.journal_repo.delete(&entry.id).await?;
        }

        // 3. Delete Stock Movements (filter by type to avoid cross-document collision)
        let mov_type = match invoice.invoice_type {
            InvoiceType::Sales => "Sale",
            InvoiceType::Purchase | InvoiceType::PurchaseCosts => "Purchase",
            InvoiceType::OpeningBalance => "OpeningBalance",
        };
        self.movement_repo.delete_by_reference(&invoice.invoice_number, mov_type).await?;

        // 4. Update Invoice Status
        invoice.reopen().map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.update(&invoice).await?;

        Ok(InvoiceDto::from(invoice))
    }
}
