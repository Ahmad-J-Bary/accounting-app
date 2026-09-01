use crate::dto::damaged_dto::{CreateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::currency_repository::CurrencyRepository;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::exchange_rate_repository::ExchangeRateRepository;
use crate::ports::inventory_lot_repository::InventoryLotRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::{MaterialInventorySummary, StockMovementRepository};
use chrono::{DateTime, Utc};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::inventory::{DamageFinancialSnapshot, DamagedItem};
use domain::shared::exchange_rate::RateType;
use domain::shared::ids::MaterialId;
use domain::shared::{Currency, Money, MonetaryAmount};
use rust_decimal::Decimal;
use rust_decimal::RoundingStrategy;
use std::sync::Arc;

pub struct CreateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    lot_repo: Arc<dyn InventoryLotRepository>,
    currency_repo: Arc<dyn CurrencyRepository>,
    exchange_rate_repo: Arc<dyn ExchangeRateRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CreateDamagedItemUseCase {
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

    pub async fn execute(&self, req: CreateDamagedItemRequest) -> Result<DamagedItemDto, AppError> {
        let material_id = req
            .material_id
            .parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;

        let material = self
            .material_repo
            .find_by_id(&material_id)
            .await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let quantity = Decimal::try_from(req.quantity)
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

        let mut item = DamagedItem::new(
            material_id,
            quantity,
            req.reason.clone().filter(|r| !r.trim().is_empty()),
            damage_date,
            financials,
            req.notes,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        let display_ref = self.repo.get_next_reference().await?;
        item.reference = Some(display_ref.clone());

        let inventory_ref = self.movement_repo.get_next_inventory_reference().await?;
        let unit_cost = if quantity > Decimal::ZERO {
            item.cost_impact() / quantity
        } else {
            Decimal::ZERO
        };
        let unit_cost_base = if quantity > Decimal::ZERO {
            item.cost_impact_base() / quantity
        } else {
            Decimal::ZERO
        };
        let reason_display = req.reason.as_deref().unwrap_or("—");
        let movement_notes = format!("{} - رقم الفاتورة {}", reason_display, display_ref);
        let mut movement = StockMovement::new(
            item.material_id,
            MovementType::Damaged,
            quantity,
            unit_cost,
            item.cost_impact(),
            inventory_ref,
            movement_notes,
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        movement.document_number = Some(display_ref.clone());
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
            &display_ref,
            damage_date,
            &base_currency,
        )
        .await?;

        self.repo
            .save_with_accounting(&item, &[movement], &[entry], None, &[])
            .await?;

        Ok(to_dto(item))
    }
}

pub async fn build_damaged_journal_entry(
    account_repo: &Arc<dyn AccountRepository>,
    entry_number: String,
    loss_base: Decimal,
    reference: &str,
    entry_date: DateTime<Utc>,
    base_currency: &Currency,
) -> Result<JournalEntry, AppError> {
    let loss_account = account_repo
        .find_by_code("45")
        .await?
        .ok_or_else(|| AppError::NotFound("حساب خسائر المواد التالفة والتسويات غير موجود: 45".into()))?;
    let inventory_account = account_repo
        .find_by_code("1241")
        .await?
        .ok_or_else(|| AppError::NotFound("حساب بضاعة آخر المدة غير موجود: 1241".into()))?;

    let lines = vec![
        JournalLine::new(
            loss_account.id,
            MonetaryAmount::from_base(loss_base, base_currency.clone()),
            MonetaryAmount::zero(base_currency.clone()),
            format!("خسائر مواد تالفة - مرجع {}", reference),
        ),
        JournalLine::new(
            inventory_account.id,
            MonetaryAmount::zero(base_currency.clone()),
            MonetaryAmount::from_base(loss_base, base_currency.clone()),
            format!("خسائر مواد تالفة - مرجع {}", reference),
        ),
    ];
    JournalEntry::new(
        entry_number,
        JournalType::DamagedJournal,
        lines,
        entry_date,
        format!("خسائر مواد تالفة - مرجع {}", reference),
        Some(reference.to_string()),
    )
    .map_err(|e| AppError::Invalid(e.to_string()))
}

pub fn to_dto(d: DamagedItem) -> DamagedItemDto {
    let reason = d.reason.clone();
    let notes = d.notes.clone();
    let reference = d.reference.clone();
    let currency_code = d.financials.currency_code.clone();
    let fx_rate = d.financials.fx_rate.to_string();
    DamagedItemDto {
        id: d.id.to_string(),
        material_id: d.material_id.to_string(),
        material_name: None,
        quantity: d.quantity.to_string(),
        reason,
        damage_date: d.damage_date.to_rfc3339(),
        cost_impact: d.cost_impact().to_string(),
        cost_impact_base: Some(d.cost_impact_base().to_string()),
        loss: Some(d.loss().to_string()),
        loss_base: Some(d.loss_base().to_string()),
        currency_code: Some(currency_code),
        fx_rate: Some(fx_rate),
        notes,
        reference,
        created_at: d.created_at.to_rfc3339(),
    }
}

pub fn base_to_original(base_amount: Decimal, fx_rate: Decimal, is_base_currency: bool) -> Decimal {
    if is_base_currency {
        base_amount.round_dp_with_strategy(4, RoundingStrategy::MidpointAwayFromZero)
    } else {
        (base_amount * fx_rate).round_dp_with_strategy(4, RoundingStrategy::MidpointAwayFromZero)
    }
}

pub async fn resolve_fx_rate(
    exchange_rate_repo: &dyn ExchangeRateRepository,
    base_currency: &Currency,
    currency: &Currency,
    transaction_date: DateTime<Utc>,
) -> Result<Decimal, AppError> {
    if currency.code == base_currency.code {
        return Ok(Decimal::ONE);
    }
    let rate = exchange_rate_repo
        .find_at_date(
            &base_currency.code,
            &currency.code,
            transaction_date,
            RateType::Middle,
        )
        .await?
        .or(
            exchange_rate_repo
                .find_latest(
                    &base_currency.code,
                    &currency.code,
                    RateType::Middle,
                )
                .await?,
        )
        .ok_or_else(|| {
            AppError::Invalid(format!(
                "لا يوجد سعر صرف محفوظ للعملة {} بتاريخ العملية {}",
                currency.code,
                transaction_date.to_rfc3339()
            ))
        })?;
    if rate.rate <= Decimal::ZERO {
        return Err(AppError::Invalid("سعر الصرف يجب أن يكون أكبر من صفر".into()));
    }
    Ok(rate.rate)
}

pub async fn compute_carrying_cost_base(
    movement_repo: &dyn StockMovementRepository,
    lot_repo: &dyn InventoryLotRepository,
    material_id: &MaterialId,
    quantity: Decimal,
) -> Result<Decimal, AppError> {
    let balance = movement_repo.get_stock_balance(material_id).await?;
    if quantity > balance {
        return Err(AppError::Invalid(format!(
            "الكمية التالفة ({}) تتجاوز الرصيد المتاح ({})",
            quantity, balance
        )));
    }

    let costing_method = lot_repo
        .get_costing_method(&material_id.to_string())
        .await
        .unwrap_or_else(|_| "Average".to_string());

    if costing_method == "FIFO" {
        let lots = lot_repo.find_available_by_material(&material_id.to_string()).await?;
        if !lots.is_empty() {
            let total_available: Decimal = lots.iter().map(|lot| lot.quantity_remaining).sum();
            if total_available < quantity {
                return Err(AppError::Invalid(format!(
                    "طبقات المخزون المتاحة ({}) أقل من الكمية التالفة ({})",
                    total_available, quantity
                )));
            }

            let mut remaining = quantity;
            let mut total = Decimal::ZERO;
            for lot in lots {
                if remaining <= Decimal::ZERO {
                    break;
                }
                let take = if lot.quantity_remaining >= remaining {
                    remaining
                } else {
                    lot.quantity_remaining
                };
                total += take * lot.unit_cost_base;
                remaining -= take;
            }
            return Ok(total.round_dp_with_strategy(4, RoundingStrategy::MidpointAwayFromZero));
        }
    }

    let summary: MaterialInventorySummary = movement_repo.get_material_summary(material_id).await?;
    let unit_cost_base = if summary.average_cost_base > Decimal::ZERO {
        summary.average_cost_base
    } else {
        summary.last_purchase_price_base
    };

    Ok((unit_cost_base * quantity).round_dp_with_strategy(4, RoundingStrategy::MidpointAwayFromZero))
}
