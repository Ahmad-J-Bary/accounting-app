use std::sync::Arc;
use std::str::FromStr;
use chrono::Utc;
use rust_decimal::Decimal;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::shared::ids::PurchaseReturnId;
use domain::shared::{Currency, Money, MonetaryAmount};
use crate::ports::purchase_return_repository::PurchaseReturnRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::account_repository::AccountRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::dto::returns_dto::PurchaseReturnDto;
use crate::errors::AppError;

use super::PurchaseReturnQueries;

pub struct PostPurchaseReturnUseCase {
    repo: Arc<dyn PurchaseReturnRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
}

impl PostPurchaseReturnUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        repo: Arc<dyn PurchaseReturnRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
        exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    ) -> Self {
        Self { repo, movement_repo, journal_repo, account_repo, supplier_repo, material_repo, currency_repo, exchange_rate_repo }
    }

    pub async fn execute(&self, id: String) -> Result<PurchaseReturnDto, AppError> {
        let rid = PurchaseReturnId::from_str(&id)
            .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
        let ret = self.repo.find_by_id(&rid).await?
            .ok_or_else(|| AppError::NotFound("مرتجع المشتريات غير موجود".into()))?;

        let base_currency = self.currency_repo.get_base_currency().await?
            .ok_or_else(|| AppError::NotFound("العملة الأساسية غير معرفة".into()))?;
        let doc_currency = Currency::new(&base_currency.code, &base_currency.code, &base_currency.code, "", 2, false);
        let fx_rate = Decimal::ONE;

        // 1. Create stock movements (OUTFLOW - goods return to supplier)
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
            
            let total_cost = line.line_total;
            let unit_cost = if effective_quantity > Decimal::ZERO {
                total_cost / effective_quantity
            } else {
                Decimal::ZERO
            };
            let unit_cost_base = unit_cost;
            let total_cost_base = total_cost;

            let mut movement = StockMovement::new(
                line.material_id,
                MovementType::PurchaseReturn,
                effective_quantity,
                unit_cost,
                total_cost,
                ret.return_number.clone(),
                format!("مرتجع مشتريات رقم {} - {}",
                    ret.return_number,
                    line.notes.as_deref().unwrap_or("")),
                Utc::now(),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.unit_cost_base = unit_cost_base;
            movement.total_cost_base = total_cost_base;
            self.movement_repo.save(&movement).await?;
        }

        // 2. Create journal entry: Dr. Supplier account, Cr. Purchase Returns (32)
        let mut journal_lines = Vec::new();
        let total = ret.total_amount;

        let purchase_return_account = self.account_repo.find_by_code("32").await?
            .ok_or_else(|| AppError::NotFound("حساب مرتجع المشتريات غير موجود: 32".into()))?;

        // Debit: Supplier account & update Supplier subledger
        if let Some(supplier) = self.supplier_repo.find_by_id(&ret.supplier_id).await? {
            if let Some(acc_id) = supplier.account_id {
                journal_lines.push(JournalLine::new(
                    acc_id,
                    MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
                    MonetaryAmount::zero(doc_currency.clone()),
                    format!("مرتجع مشتريات رقم {}", ret.return_number),
                ).with_partner(ret.supplier_id.0));
            }

            // Decrease supplier's credit balance (reversing the outstanding balance)
            let converted_total = crate::use_cases::unified_invoice::post::convert_to_partner_currency(
                total,
                &base_currency.code,
                Decimal::ONE,
                &supplier.currency.code,
                &self.currency_repo,
                &self.exchange_rate_repo,
            ).await?;
            let mut updated_supplier = supplier;
            updated_supplier.decrease_credit(converted_total).map_err(|e| AppError::Invalid(e.to_string()))?;
            self.supplier_repo.update(&updated_supplier).await?;
        }

        // Credit: Purchase Returns account (revenue - reduces COGS)
        journal_lines.push(JournalLine::new(
            purchase_return_account.id,
            MonetaryAmount::zero(doc_currency.clone()),
            MonetaryAmount::new(Money::new(total, doc_currency.clone()), fx_rate),
            format!("مرتجع مشتريات رقم {}", ret.return_number),
        ));

        if !journal_lines.is_empty() {
            let mut entry = JournalEntry::new(
                self.journal_repo.get_next_entry_number().await?,
                domain::accounting::JournalType::PurchaseReturnJournal,
                journal_lines,
                Utc::now(),
                format!("قيد آلي لمرتجع المشتريات رقم {}", ret.return_number),
                Some(ret.id.0.to_string()),
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        let dto = PurchaseReturnDto::from(ret);
        let queries = PurchaseReturnQueries::new(
            self.repo.clone(),
            self.supplier_repo.clone(),
            self.material_repo.clone(),
        );
        queries.populate(dto).await
    }
}
