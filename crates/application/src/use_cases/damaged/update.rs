use crate::dto::damaged_dto::{UpdateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use chrono::{DateTime, Utc};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::ids::{DamagedItemId, MaterialId};
use rust_decimal::Decimal;
use std::sync::Arc;
use crate::use_cases::damaged::create::{to_dto, build_damaged_journal_entry};

pub struct UpdateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl UpdateDamagedItemUseCase {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self {
            repo,
            material_repo,
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
            .unwrap_or_else(|| super::create::BASE_CURRENCY.to_string());
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

        item.material_id = material_id;
        item.quantity = quantity;
        item.reason = req.reason.clone().filter(|r| !r.trim().is_empty());
        item.damage_date = damage_date;
        item.cost_impact = cost_impact;
        item.notes = req.notes;

        if item.reference.is_none() {
            let reference = self.repo.get_next_reference().await?;
            item.reference = Some(reference);
        }
        let reference = item.reference.clone().unwrap_or_else(|| format!("DAM-{}", item.id));

        // Delete old journal entry — drafts only; posted entries are immutable.
        let old_entry = self.journal_repo.find_by_source_id(&reference).await?;
        let mut delete_entries = Vec::new();
        if let Some(old_entry) = old_entry {
            crate::use_cases::journal::guards::ensure_deletable(std::slice::from_ref(&old_entry))?;
            delete_entries.push(old_entry.id);
        }

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
        let reason_display = req.reason.as_deref().unwrap_or("—");
        let movement_notes = format!("{} - رقم الفاتورة {}", reason_display, reference);
        let mut movement = StockMovement::new(
            item.material_id,
            MovementType::Damaged,
            quantity,
            unit_cost,
            cost_impact,
            reference.clone(),
            movement_notes,
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        movement.document_number = Some(reference.clone());
        movement.original_currency = Some(currency_code.clone());
        movement.fx_rate = fx_rate;
        movement.unit_cost_base = unit_cost_base;
        movement.total_cost_base = cost_impact_base;
        movement.raw_total_cost_base = cost_impact_base;

        // Build new journal entry (persisted atomically below). Balances are
        // stored in the base currency (converted above).
        let entry_number = self.journal_repo.get_next_entry_number().await?;
        let entry = build_damaged_journal_entry(
            &self.account_repo,
            entry_number,
            cost_impact_base,
            &reference,
            damage_date,
        ).await?;

        // Commit old-entry deletions + doc + movement + journal in ONE
        // transaction (Sec 9 atomicity).
        self.repo.save_with_accounting(
            &item,
            &[movement],
            &[entry],
            Some(&reference),
            &delete_entries,
        ).await?;

        Ok(to_dto(item, currency_code, fx_rate, cost_impact_base))
    }
}
