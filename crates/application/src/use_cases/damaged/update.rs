use crate::dto::damaged_dto::{DamagedItemDto, UpdateDamagedItemRequest};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::ports::inventory_lot_repository::InventoryLotRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use chrono::{DateTime, Utc};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::inventory::DamageFinancialSnapshot;
use domain::shared::ids::{DamagedItemId, MaterialId};
use domain::shared::{Currency, MonetaryAmount, Money};
use std::sync::Arc;

use crate::use_cases::damaged::create::{
    base_to_original, build_damaged_journal_entry, compute_carrying_cost_base, resolve_fx_rate,
    to_dto,
};

pub struct UpdateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    lot_repo: Arc<dyn InventoryLotRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl UpdateDamagedItemUseCase {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        lot_repo: Arc<dyn InventoryLotRepository>,
        currency_repo: Arc<dyn CurrencyRepository>,
        exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            repo,
            material_repo,
            movement_repo,
            lot_repo,
            currency_repo,
            exchange_rate_repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, req: UpdateDamagedItemRequest) -> Result<DamagedItemDto, AppError> {
        let id = req
            .id
            .parse::<DamagedItemId>()
            .map_err(|_| AppError::Invalid("معرف التالف غير صالح".into()))?;
        let mut item = self
            .repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| AppError::NotFound("سجل التالف غير موجود".into()))?;

        let material_id = req
            .material_id
            .parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;
        let material = self
            .material_repo
            .find_by_id(&material_id)
            .await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let quantity = rust_decimal::Decimal::try_from(req.quantity)
            .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
        let damage_date = DateTime::parse_from_rfc3339(&req.damage_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&Utc);

        let base_currency = self
            .currency_repo
            .get_base_currency()
            .await?
            .ok_or_else(|| AppError::Invalid("لا توجد عملة أساسية معرفة".into()))?;
        let currency_code = material
            .default_purchase_currency
            .clone()
            .filter(|c| !c.trim().is_empty())
            .unwrap_or_else(|| base_currency.code.clone());
        let currency = self
            .currency_repo
            .find_by_code(&currency_code)
            .await?
            .unwrap_or_else(|| {
                Currency::new(
                    &currency_code,
                    &currency_code,
                    &currency_code,
                    &currency_code,
                    base_currency.decimals,
                    currency_code == base_currency.code,
                )
            });

        let fx_rate = resolve_fx_rate(
            &*self.exchange_rate_repo,
            &base_currency,
            &currency,
            damage_date,
        )
        .await?;
        let cost_impact_base = compute_carrying_cost_base(
            &*self.movement_repo,
            &*self.lot_repo,
            &material_id,
            quantity,
        )
        .await?;
        let cost_impact = base_to_original(cost_impact_base, fx_rate, currency.is_base);
        let monetary = MonetaryAmount::new(Money::new(cost_impact, currency.clone()), fx_rate);
        let financials = DamageFinancialSnapshot::full_damage(monetary, &base_currency)
            .map_err(|e| AppError::Invalid(e.to_string()))?;

        item.material_id = material_id;
        item.quantity = quantity;
        item.reason = req.reason.clone().filter(|r| !r.trim().is_empty());
        item.damage_date = damage_date;
        item.financials = financials;
        item.notes = req.notes;

        if item.reference.is_none() {
            item.reference = Some(self.repo.get_next_reference().await?);
        }
        let reference = item
            .reference
            .clone()
            .unwrap_or_else(|| format!("DAM-{}", item.id));

        let old_entry = self.journal_repo.find_by_source_id(&reference).await?;
        let mut delete_entries = Vec::new();
        if let Some(old_entry) = old_entry {
            crate::use_cases::journal::guards::ensure_deletable(std::slice::from_ref(&old_entry))?;
            delete_entries.push(old_entry.id);
        }

        let unit_cost = if quantity > rust_decimal::Decimal::ZERO {
            item.cost_impact() / quantity
        } else {
            rust_decimal::Decimal::ZERO
        };
        let unit_cost_base = if quantity > rust_decimal::Decimal::ZERO {
            item.cost_impact_base() / quantity
        } else {
            rust_decimal::Decimal::ZERO
        };
        let reason_display = req.reason.as_deref().unwrap_or("—");
        let movement_notes = format!("{} - رقم الفاتورة {}", reason_display, reference);
        let mut movement = StockMovement::new(
            item.material_id,
            MovementType::Damaged,
            quantity,
            unit_cost,
            item.cost_impact(),
            reference.clone(),
            movement_notes,
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        movement.document_number = Some(reference.clone());
        movement.original_currency = Some(item.financials.currency_code.clone());
        movement.fx_rate = item.financials.fx_rate;
        movement.unit_cost_base = unit_cost_base;
        movement.total_cost_base = item.cost_impact_base();
        movement.raw_total_cost_base = item.cost_impact_base();

        let entry_number = self.journal_repo.get_next_entry_number().await?;
        let entry = build_damaged_journal_entry(
            &self.account_repo,
            entry_number,
            item.loss_base(),
            &reference,
            damage_date,
            &base_currency,
        )
        .await?;

        self.repo
            .save_with_accounting(
                &item,
                &[movement],
                &[entry],
                Some(&reference),
                &delete_entries,
            )
            .await?;

        Ok(to_dto(item))
    }
}
