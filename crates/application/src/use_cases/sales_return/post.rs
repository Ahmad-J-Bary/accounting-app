use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::ids::{SalesReturnId};
use domain::shared::{Currency, Money, MonetaryAmount};
use crate::ports::sales_return_repository::SalesReturnRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::dto::returns_dto::SalesReturnDto;
use crate::errors::AppError;

use super::SalesReturnQueries;

pub struct PostSalesReturnUseCase {
    repo: Arc<dyn SalesReturnRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl PostSalesReturnUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        repo: Arc<dyn SalesReturnRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
        exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self { repo, movement_repo, journal_repo, account_repo, customer_repo, material_repo, currency_repo, exchange_rate_repo }
    }

    pub async fn execute(&self, id: String) -> Result<SalesReturnDto, AppError> {
        let rid = SalesReturnId::from_str(&id)
            .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
        let ret = self.repo.find_by_id(&rid).await?
            .ok_or_else(|| AppError::NotFound("مرتجع المبيعات غير موجود".into()))?;

        let base_currency = self.currency_repo.get_base_currency().await?
            .ok_or_else(|| AppError::NotFound("العملة الأساسية غير معرفة".into()))?;
        let doc_currency = Currency::new(&base_currency.code, &base_currency.code, &base_currency.code, "", 2, false);
        let fx_rate = Decimal::ONE;

        // 1. Create stock movements (INFLOW - goods return to inventory)
        for line in &ret.lines {
            // Get material to find conversion factor for the line's unit
            let material = self.material_repo.find_by_id(&line.material_id).await?
                .ok_or_else(|| AppError::NotFound(format!("المادة مع المعرف {} غير موجودة", line.material_id)))?;
            
            // Find conversion factor for the line's unit, default to 1 if not found
            let conversion_factor = if let Some(ref unit_id) = line.unit_id {
                material.units.iter()
                    .find(|u| u.id.to_string() == *unit_id)
                    .map(|u| u.conversion_factor)
                    .unwrap_or(Decimal::ONE)
            } else {
                Decimal::ONE
            };
            
            let effective_quantity = line.quantity * conversion_factor;
            
            // For SalesReturn, the stock movement cost MUST reflect the INVENTORY COST (average cost),
            // NOT the sale/refund price. Returned goods re-enter inventory at their original
            // purchase cost so that Ending Inventory is correctly valued.
            let summary = self.movement_repo.get_material_summary(&line.material_id).await
                .unwrap_or(crate::ports::stock_movement_repository::MaterialInventorySummary {
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

            let unit_cost = summary.average_cost;
            let total_cost = unit_cost * effective_quantity;
            let unit_cost_base = summary.average_cost_base;
            let total_cost_base = unit_cost_base * effective_quantity;
            
            let mut movement = StockMovement::new(
                line.material_id,
                MovementType::SalesReturn,
                effective_quantity,
                unit_cost,
                total_cost,
                ret.return_number.clone(),
                format!("مرتجع مبيعات رقم {} - {}",
                    ret.return_number,
                    line.notes.as_deref().unwrap_or("")),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.unit_cost_base = unit_cost_base;
            movement.total_cost_base = total_cost_base;
            self.movement_repo.save(&movement).await?;
        }

        // 2. Create journal entry: Dr. Sales Returns (42), Cr. Customer account
        let mut journal_lines = Vec::new();
        let total = ret.total_amount;

        let sales_return_account = self.account_repo.find_by_code("42").await?
            .ok_or_else(|| AppError::NotFound("حساب مرتجع المبيعات غير موجود: 42".into()))?;

        // Debit: Sales Returns account (expense)
        journal_lines.push(JournalLine::new(
            sales_return_account.id,
            MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
            MonetaryAmount::zero(doc_currency.clone()),
            format!("مرتجع مبيعات رقم {}", ret.return_number),
        ));

        // Credit: Customer account & update Customer subledger
        if let Some(customer) = self.customer_repo.find_by_id(&ret.customer_id).await? {
            if let Some(acc_id) = customer.account_id {
                journal_lines.push(JournalLine::new(
                    acc_id,
                    MonetaryAmount::zero(doc_currency.clone()),
                    MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
                    format!("مرتجع مبيعات رقم {}", ret.return_number),
                ).with_partner(ret.customer_id.0));
            }

            // Decrease customer's debit balance (reversing the outstanding balance)
            let converted_total = crate::use_cases::unified_invoice::post::convert_to_partner_currency(
                total,
                &base_currency.code,
                Decimal::ONE,
                &customer.currency.code,
                &self.currency_repo,
                &self.exchange_rate_repo,
            ).await?;
            let mut updated_customer = customer;
            updated_customer.decrease_debit(converted_total).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.customer_repo.update(&updated_customer).await?;
        }

        if !journal_lines.is_empty() {
            let mut entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                domain::accounting::JournalType::SalesReturnJournal,
                journal_lines,
                Utc::now(),
                format!("قيد آلي لمرتجع المبيعات رقم {}", ret.return_number),
                Some(ret.id.0.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        let dto = SalesReturnDto::from(ret);
        let queries = SalesReturnQueries::new(
            self.repo.clone(),
            self.customer_repo.clone(),
            self.material_repo.clone(),
        );
        queries.populate(dto).await
    }
}
