use super::create::{build_adjustment_journal_entry, to_dto};
use crate::dto::adjustment_dto::{StockAdjustmentDto, UpdateStockAdjustmentRequest};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::fiscal_period_repository::FiscalPeriodRepository;
use crate::ports::fiscal_year_repository::FiscalYearRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::use_cases::shared::fiscal_lifecycle::FiscalLifecyclePolicy;
use chrono::DateTime;
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::ids::{MaterialId, StockAdjustmentId};
use rust_decimal::Decimal;
use std::sync::Arc;

pub struct UpdateStockAdjustmentUseCase {
    adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    fiscal_year_repo: Arc<dyn FiscalYearRepository>,
    fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
}

impl UpdateStockAdjustmentUseCase {
    pub fn new(
        adjustment_repo: Arc<dyn StockAdjustmentRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        fiscal_year_repo: Arc<dyn FiscalYearRepository>,
        fiscal_period_repo: Arc<dyn FiscalPeriodRepository>,
    ) -> Self {
        Self {
            adjustment_repo,
            material_repo,
            movement_repo,
            account_repo,
            journal_repo,
            fiscal_year_repo,
            fiscal_period_repo,
        }
    }

    pub async fn execute(
        &self,
        req: UpdateStockAdjustmentRequest,
    ) -> Result<StockAdjustmentDto, AppError> {
        let id = req
            .id
            .parse::<StockAdjustmentId>()
            .map_err(|_| AppError::Invalid("معرف التسوية غير صالح".into()))?;

        let mut adjustment = self
            .adjustment_repo
            .find_by_id(&id)
            .await?
            .ok_or_else(|| AppError::NotFound("التسوية غير موجودة".into()))?;

        let material_id = req
            .material_id
            .parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;

        let material = self
            .material_repo
            .find_by_id(&material_id)
            .await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let current_balance = self.movement_repo.get_stock_balance(&material_id).await?;

        let actual_quantity = Decimal::try_from(req.actual_quantity)
            .map_err(|_| AppError::Invalid("الكمية المجرود غير صالحة".into()))?;

        let unit_cost = Decimal::try_from(req.unit_cost)
            .map_err(|_| AppError::Invalid("التكلفة غير صالحة".into()))?;

        let currency_code = req
            .currency_code
            .clone()
            .filter(|c| !c.trim().is_empty())
            .or_else(|| material.default_purchase_currency.clone())
            .unwrap_or_else(|| super::create::BASE_CURRENCY.to_string());
        let fx_rate = Decimal::try_from(req.fx_rate.unwrap_or(1.0))
            .map_err(|_| AppError::Invalid("سعر الصرف غير صالح".into()))?;
        // Base conversion: 1 base = fx_rate foreign units, so base = / fx_rate.
        let unit_cost_base = (unit_cost / fx_rate)
            .round_dp_with_strategy(4, rust_decimal::RoundingStrategy::MidpointAwayFromZero);

        let adjustment_date = DateTime::parse_from_rfc3339(&req.adjustment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        FiscalLifecyclePolicy::new(self.fiscal_year_repo.clone(), self.fiscal_period_repo.clone())
            .validate_normal_operational(None, adjustment_date)
            .await?;

        if current_balance < Decimal::ZERO {
            return Err(AppError::Invalid("كمية النظام لا يمكن أن تكون سالبة".into()));
        }
        if actual_quantity < Decimal::ZERO {
            return Err(AppError::Invalid(
                "الكمية المجرودة لا يمكن أن تكون سالبة".into(),
            ));
        }

        adjustment.material_id = material_id;
        adjustment.system_quantity = current_balance;
        adjustment.actual_quantity = actual_quantity;
        adjustment.difference = actual_quantity - current_balance;
        adjustment.reason = req.reason;
        adjustment.unit_cost = unit_cost;
        adjustment.notes = req.notes;
        adjustment.adjustment_date = adjustment_date;

        // Delete old stock movement
        let display_ref = adjustment
            .reference
            .clone()
            .unwrap_or_else(|| adjustment.id.to_string());

        // Delete old journal entry — drafts only; posted entries are immutable.
        let old_entry = self.journal_repo.find_by_source_id(&display_ref).await?;
        let mut delete_entries = Vec::new();
        if let Some(old_entry) = old_entry {
            crate::use_cases::journal::guards::ensure_deletable(std::slice::from_ref(&old_entry))?;
            delete_entries.push(old_entry.id);
        }

        let inventory_ref = self.movement_repo.get_next_inventory_reference().await?;

        // Create new stock movement
        let difference = adjustment.difference;
        let abs_diff = difference.abs();
        let mut movements = Vec::new();
        let mut entries = Vec::new();
        if abs_diff > Decimal::ZERO {
            let notes = if difference > Decimal::ZERO {
                "تسوية: فائض".to_string()
            } else {
                "تسوية: عجز".to_string()
            };
            let quantity_unit_cost = if abs_diff > Decimal::ZERO {
                unit_cost / abs_diff
            } else {
                Decimal::ZERO
            };
            let quantity_unit_cost_base = if abs_diff > Decimal::ZERO {
                unit_cost_base / abs_diff
            } else {
                Decimal::ZERO
            };
            let base_notes = if let Some(ref user_notes) = adjustment.notes {
                format!("{} - {}", notes, user_notes)
            } else {
                notes
            };
            let movement_notes = format!("{} - رقم الفاتورة {}", base_notes, display_ref);
            let mut movement = StockMovement::new(
                adjustment.material_id,
                MovementType::Adjustment,
                abs_diff,
                quantity_unit_cost,
                unit_cost,
                inventory_ref.clone(),
                movement_notes,
                adjustment.adjustment_date,
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.signed_quantity = Some(difference);
            movement.document_number = Some(display_ref.clone());
            movement.original_currency = Some(currency_code.clone());
            movement.fx_rate = fx_rate;
            movement.unit_cost_base = quantity_unit_cost_base;
            movement.total_cost_base = unit_cost_base;
            movement.raw_total_cost_base = unit_cost_base;
            movements.push(movement);

            // Build journal entry for adjustment (persisted atomically below).
            // Balances are stored in the base currency (converted above).
            let entry_number = self.journal_repo.get_next_entry_number().await?;
            let entry = build_adjustment_journal_entry(
                &self.account_repo,
                entry_number,
                unit_cost_base,
                difference,
                &display_ref,
                adjustment.adjustment_date,
            )
            .await?;
            entries.push(entry);
        }

        // Commit old-entry deletions + doc + movement + journal in ONE
        // transaction (Sec 9 atomicity).
        self.adjustment_repo
            .save_with_accounting(
                &adjustment,
                &movements,
                &entries,
                Some(&display_ref),
                &delete_entries,
            )
            .await?;

        Ok(to_dto(adjustment, material.name, currency_code, fx_rate))
    }
}
