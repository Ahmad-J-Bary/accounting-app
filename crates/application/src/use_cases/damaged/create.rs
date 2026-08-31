use crate::dto::damaged_dto::{CreateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use chrono::{DateTime, Utc};
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::inventory::DamagedItem;
use domain::shared::ids::MaterialId;
use domain::shared::{Currency, MonetaryAmount};
use rust_decimal::Decimal;
use std::sync::Arc;

pub const BASE_CURRENCY: &str = "SAR";

pub struct CreateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CreateDamagedItemUseCase {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            repo,
            material_repo,
            movement_repo,
            account_repo,
            journal_repo,
        }
    }

    pub async fn execute(&self, req: CreateDamagedItemRequest) -> Result<DamagedItemDto, AppError> {
        let material_id = req
            .material_id
            .parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;

        let _material = self
            .material_repo
            .find_by_id(&material_id)
            .await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let quantity = Decimal::try_from(req.quantity)
            .map_err(|_| AppError::Invalid("الكمية غير صالحة".into()))?;
        let cost_impact = Decimal::try_from(req.cost_impact)
            .map_err(|_| AppError::Invalid("قيمة التكلفة غير صالحة".into()))?;

        // Resolve the entry currency + exchange rate. Defaults to the
        // material's purchase currency, otherwise the base currency (SAR).
        let currency_code = req
            .currency_code
            .clone()
            .filter(|c| !c.trim().is_empty())
            .or_else(|| _material.default_purchase_currency.clone())
            .unwrap_or_else(|| BASE_CURRENCY.to_string());
        let fx_rate = Decimal::try_from(req.fx_rate.unwrap_or(1.0))
            .map_err(|_| AppError::Invalid("سعر الصرف غير صالح".into()))?;
        // Base conversion: 1 base = fx_rate foreign units, so base = / fx_rate.
        let cost_impact_base = (cost_impact / fx_rate).round_dp_with_strategy(
            4,
            rust_decimal::RoundingStrategy::MidpointAwayFromZero,
        );
        let damage_date = DateTime::parse_from_rfc3339(&req.damage_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&Utc);

        let mut item = DamagedItem::new(
            material_id,
            quantity,
            req.reason.clone(),
            damage_date,
            cost_impact,
            req.notes,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;

        let display_ref = self.repo.get_next_reference().await?;
        item.reference = Some(display_ref.clone());

        let inventory_ref = self.movement_repo.get_next_inventory_reference().await?;

        let unit_cost = if quantity > Decimal::ZERO {
            cost_impact / quantity
        } else {
            Decimal::ZERO
        };
        let unit_cost_base = if quantity > Decimal::ZERO {
            cost_impact_base / quantity
        } else {
            Decimal::ZERO
        };
        let movement_notes = format!("{} - رقم الفاتورة {}", req.reason.clone(), display_ref);
        let mut movement = StockMovement::new(
            item.material_id,
            MovementType::Damaged,
            quantity,
            unit_cost,
            cost_impact,
            inventory_ref.clone(),
            movement_notes,
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        movement.document_number = Some(display_ref.clone());
        movement.original_currency = Some(currency_code.clone());
        movement.fx_rate = fx_rate;
        movement.unit_cost_base = unit_cost_base;
        movement.total_cost_base = cost_impact_base;
        movement.raw_total_cost_base = cost_impact_base;

        // Build journal entry: Dr 45 (خسائر المواد التالفة والتسويات), Cr 1241 (بضاعة آخر المدة)
        // Balances are stored in the base currency (converted above).
        let entry_number = self.journal_repo.get_next_entry_number().await?;
        let entry = build_damaged_journal_entry(
            &self.account_repo,
            entry_number,
            cost_impact_base,
            &display_ref,
            damage_date,
        ).await?;

        // Commit doc + movement + journal in ONE transaction (Sec 9 atomicity).
        self.repo.save_with_accounting(&item, &[movement], &[entry], None, &[]).await?;

        Ok(to_dto(item, Some(display_ref), currency_code, fx_rate, cost_impact_base))
    }
}

pub async fn build_damaged_journal_entry(
    account_repo: &Arc<dyn AccountRepository>,
    entry_number: String,
    cost_impact: Decimal,
    reference: &str,
    entry_date: DateTime<Utc>,
) -> Result<JournalEntry, AppError> {
    let loss_account = account_repo.find_by_code("45").await?
        .ok_or_else(|| AppError::NotFound("حساب خسائر المواد التالفة والتسويات غير موجود: 45".into()))?;
    let inventory_account = account_repo.find_by_code("1241").await?
        .ok_or_else(|| AppError::NotFound("حساب بضاعة آخر المدة غير موجود: 1241".into()))?;

    let base_currency = Currency::new(BASE_CURRENCY, BASE_CURRENCY, "ريال", "ر.س", 2, false);
    let lines = vec![
        JournalLine::new(
            loss_account.id,
            MonetaryAmount::from_base(cost_impact, base_currency.clone()),
            MonetaryAmount::zero(base_currency.clone()),
            format!("خسائر مواد تالفة - مرجع {}", reference),
        ),
        JournalLine::new(
            inventory_account.id,
            MonetaryAmount::zero(base_currency.clone()),
            MonetaryAmount::from_base(cost_impact, base_currency.clone()),
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

pub fn to_dto(
    d: DamagedItem,
    reference: Option<String>,
    currency_code: String,
    fx_rate: Decimal,
    cost_impact_base: Decimal,
) -> DamagedItemDto {
    DamagedItemDto {
        id: d.id.to_string(),
        material_id: d.material_id.to_string(),
        material_name: None,
        quantity: d.quantity.to_string(),
        reason: d.reason,
        damage_date: d.damage_date.to_rfc3339(),
        cost_impact: d.cost_impact.to_string(),
        cost_impact_base: Some(cost_impact_base.to_string()),
        currency_code: Some(currency_code),
        fx_rate: Some(fx_rate.to_string()),
        notes: d.notes,
        reference,
        created_at: d.created_at.to_rfc3339(),
    }
}
