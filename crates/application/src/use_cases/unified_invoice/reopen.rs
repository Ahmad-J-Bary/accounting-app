use std::sync::Arc;
use std::str::FromStr;
use rust_decimal::Decimal;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use domain::sales::unified_invoice::{InvoiceType, InvoiceStatus};
use domain::shared::ids::{InvoiceId};
use crate::ports::unified_invoice_repository::UnifiedInvoiceRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::inventory_lot_repository::InventoryLotRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::dto::invoice_dto::{InvoiceDto};
use crate::errors::AppError;

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
    lot_repo: Arc<dyn InventoryLotRepository>,
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
        lot_repo: Arc<dyn InventoryLotRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
        exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self {
            repo,
            movement_repo,
            lot_repo,
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

        // 2. Before deleting movements, handle inventory lot restoration
        if invoice.invoice_type == InvoiceType::Purchase || invoice.invoice_type == InvoiceType::OpeningBalance {
            // Delete lots created by this purchase invoice
            self.lot_repo.delete_by_purchase_invoice(&invoice.id.to_string()).await?;
        } else if invoice.invoice_type == InvoiceType::Sales {
            // Restore lot quantities consumed by this sale
            // Get all movements for this invoice reference
            let sales_movements = self.movement_repo.list_by_reference(&invoice.invoice_number).await?;

            for movement in &sales_movements {
                let material_id = movement.material_id.to_string();
                let consumed_qty = movement.quantity;

                // Get available lots for this material, ordered FIFO (same order as consumption)
                let mut lots = self.lot_repo.find_available_by_material(&material_id).await?;

                if lots.is_empty() {
                    // If no lots exist (e.g. all consumed), get ALL lots for this material
                    // and restore based on original quantities
                    lots = self.lot_repo.find_available_by_material(&material_id).await?;
                }

                // Sort lots by purchase_date ASC to match consumption order
                lots.sort_by(|a, b| a.purchase_date.cmp(&b.purchase_date));

                if !lots.is_empty() {
                    // Restore consumed quantity to the lots, starting from the oldest
                    // The oldest lots were consumed first, so they get restored first
                    let mut remaining_restore = consumed_qty;

                    for lot in &lots {
                        if remaining_restore <= Decimal::ZERO {
                            break;
                        }
                        let max_restore = lot.quantity_original - lot.quantity_remaining;
                        if max_restore <= Decimal::ZERO {
                            continue;
                        }
                        let restore = if max_restore >= remaining_restore {
                            remaining_restore
                        } else {
                            max_restore
                        };
                        let new_remaining = lot.quantity_remaining + restore;
                        self.lot_repo.update_remaining(
                            &lot.id.to_string(),
                            &new_remaining.to_string(),
                        ).await?;
                        remaining_restore -= restore;
                    }
                }
            }
        }

        // 3. Delete all journal entries linked to this invoice
        let entries = self.journal_repo.find_all_by_source_id(&invoice.id.to_string()).await?;
        for entry in entries {
            self.journal_repo.delete(&entry.id).await?;
        }

        // 4. Delete Stock Movements
        let mov_type = match invoice.invoice_type {
            InvoiceType::Sales => "Sale",
            InvoiceType::Purchase | InvoiceType::PurchaseCosts => "Purchase",
            InvoiceType::OpeningBalance => "OpeningBalance",
        };
        self.movement_repo.delete_by_reference(&invoice.invoice_number, mov_type).await?;

        // 5. Update Invoice Status
        invoice.reopen().map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.update(&invoice).await?;

        Ok(InvoiceDto::from(invoice))
    }
}
