use std::sync::Arc;
use std::str::FromStr;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use domain::sales::unified_invoice::{InvoiceType, InvoiceStatus};
use domain::shared::ids::{InvoiceId};
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::errors::AppError;

pub struct DeleteInvoiceUseCase {
    repo: Arc<dyn UnifiedInvoiceRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl DeleteInvoiceUseCase {
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

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let invoice_id = InvoiceId::from_str(&id).map_err(|_| AppError::Invalid("معرف فاتورة غير صالح".into()))?;
        let invoice = self.repo.find_by_id(&invoice_id).await?
            .ok_or_else(|| AppError::NotFound("الفاتورة غير موجودة".into()))?;

        // 1. If posted, we need to reverse everything first (similar to reopen)
        if invoice.status == InvoiceStatus::Posted {
            let amount_deferred = invoice.total_amount.amount() - invoice.amount_paid.amount();

            // Reverse Party Balance (Subledger)
            if amount_deferred > rust_decimal::Decimal::ZERO {
                match invoice.invoice_type {
                    InvoiceType::Sales => {
                        if let Some(cid) = &invoice.customer_id {
                            if let Some(mut customer) = self.customer_repo.find_by_id(cid).await? {
                                let converted_deferred = super::post::convert_to_partner_currency(
                                    amount_deferred,
                                    &invoice.currency_code,
                                    invoice.exchange_rate,
                                    &customer.currency.code,
                                    &self.currency_repo,
                                    &self.exchange_rate_repo,
                                ).await?;
                                customer.decrease_debit(converted_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                                self.customer_repo.update(&customer).await?;
                            }
                        }
                    },
                    InvoiceType::Purchase => {
                        if let Some(sid) = &invoice.supplier_id {
                            if let Some(mut supplier) = self.supplier_repo.find_by_id(sid).await? {
                                let converted_deferred = super::post::convert_to_partner_currency(
                                    amount_deferred,
                                    &invoice.currency_code,
                                    invoice.exchange_rate,
                                    &supplier.currency.code,
                                    &self.currency_repo,
                                    &self.exchange_rate_repo,
                                ).await?;
                                supplier.decrease_credit(converted_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                                self.supplier_repo.update(&supplier).await?;
                            }
                        }
                    },
                    _ => {}
                }
            }

            // Delete all journal entries linked to this invoice
            let entries = self.journal_repo.find_all_by_source_id(&invoice.id.to_string()).await?;
            for entry in entries {
                self.journal_repo.delete(&entry.id).await?;
            }

            // Delete Stock Movements
            self.movement_repo.delete_by_reference(&invoice.invoice_number).await?;
        }

        // 2. Finally delete the invoice itself
        self.repo.delete(&invoice_id).await?;

        Ok(())
    }
}
