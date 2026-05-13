use std::sync::Arc;
use std::str::FromStr;
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
}

impl DeleteInvoiceUseCase {
    pub fn new(
        repo: Arc<dyn UnifiedInvoiceRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
    ) -> Self {
        Self { repo, movement_repo, journal_repo, customer_repo, supplier_repo }
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
                                customer.decrease_debit(amount_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                                self.customer_repo.update(&customer).await?;
                            }
                        }
                    },
                    InvoiceType::Purchase => {
                        if let Some(sid) = &invoice.supplier_id {
                            if let Some(mut supplier) = self.supplier_repo.find_by_id(sid).await? {
                                supplier.decrease_credit(amount_deferred).map_err(|e| AppError::Invalid(e.to_string()))?;
                                self.supplier_repo.update(&supplier).await?;
                            }
                        }
                    },
                    _ => {}
                }
            }

            // Delete Journal Entry
            if let Some(entry) = self.journal_repo.find_by_source_id(&invoice.id.to_string()).await? {
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
