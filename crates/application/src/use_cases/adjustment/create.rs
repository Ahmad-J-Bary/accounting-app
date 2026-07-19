use std::sync::Arc;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use domain::accounting::journal_entry::{JournalEntry, JournalLine, JournalType};
use domain::inventory::StockAdjustment;
use domain::inventory::stock_movement::{StockMovement, MovementType};
use domain::shared::ids::MaterialId;
use domain::shared::{Currency, MonetaryAmount};
use crate::ports::account_repository::AccountRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::adjustment_dto::{CreateStockAdjustmentRequest, StockAdjustmentDto};
use crate::errors::AppError;

const BASE_CURRENCY: &str = "SAR";

pub struct CreateStockAdjustmentUseCase {
    adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl CreateStockAdjustmentUseCase {
    pub fn new(
        adjustment_repo: Arc<dyn StockAdjustmentRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        account_repo: Arc<dyn AccountRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { adjustment_repo, material_repo, movement_repo, account_repo, journal_repo }
    }

    pub async fn execute(&self, req: CreateStockAdjustmentRequest) -> Result<StockAdjustmentDto, AppError> {
        let material_id = req.material_id.parse::<MaterialId>()
            .map_err(|_| AppError::Invalid("معرف المادة غير صالح".into()))?;

        let material = self.material_repo.find_by_id(&material_id).await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let current_balance = self.movement_repo.get_stock_balance(&material_id).await?;

        let actual_quantity = Decimal::try_from(req.actual_quantity)
            .map_err(|_| AppError::Invalid("الكمية المجرود غير صالحة".into()))?;

        let unit_cost = Decimal::try_from(req.unit_cost)
            .map_err(|_| AppError::Invalid("التكلفة غير صالحة".into()))?;

        let adjustment_date = DateTime::parse_from_rfc3339(&req.adjustment_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&chrono::Utc);

        let mut adjustment = StockAdjustment::new(
            material_id,
            current_balance,
            actual_quantity,
            req.reason,
            unit_cost,
            req.notes.clone(),
            adjustment_date,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        let display_ref = self.adjustment_repo.get_next_reference().await?;
        adjustment.reference = Some(display_ref.clone());
        self.adjustment_repo.save(&adjustment).await?;

        let inventory_ref = self.movement_repo.get_next_inventory_reference().await?;

        // Create a stock movement for inventory tracking
        let difference = adjustment.difference;
        let abs_diff = difference.abs();
        if abs_diff > Decimal::ZERO {
            let notes = if difference > Decimal::ZERO {
                "تسوية: فائض".to_string()
            } else {
                "تسوية: عجز".to_string()
            };
            let quantity_unit_cost = unit_cost / abs_diff;
            let total_cost_value = unit_cost;
            let base_notes = if let Some(ref user_notes) = req.notes {
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
                total_cost_value,
                inventory_ref.clone(),
                movement_notes,
                adjustment.adjustment_date,
            ).map_err(|e| AppError::Invalid(e.to_string()))?;
            movement.signed_quantity = Some(difference);
            movement.document_number = Some(display_ref.clone());
            self.movement_repo.save(&movement).await?;

            // Create journal entry for adjustment
            create_adjustment_journal_entry(
                &self.account_repo,
                &self.journal_repo,
                unit_cost,
                difference,
                &display_ref,
                adjustment.adjustment_date,
            ).await?;
        }

        Ok(to_dto(adjustment, material.name))
    }
}

pub async fn create_adjustment_journal_entry(
    account_repo: &Arc<dyn AccountRepository>,
    journal_repo: &Arc<dyn JournalEntryRepository>,
    total_value: Decimal,
    difference: Decimal,
    reference: &str,
    entry_date: DateTime<Utc>,
) -> Result<(), AppError> {
    let base_currency = Currency::new(BASE_CURRENCY, BASE_CURRENCY, "ريال", "ر.س", 2, false);
    let entry_number = journal_repo.get_next_entry_number().await?;

    if difference > Decimal::ZERO {
        // Surplus: Dr 1241 (بضاعة آخر المدة), Cr 331 (أرباح تسوية المخزون)
        let inventory_account = account_repo.find_by_code("1241").await?
            .ok_or_else(|| AppError::NotFound("حساب بضاعة آخر المدة غير موجود: 1241".into()))?;
        let gain_account = account_repo.find_by_code("331").await?
            .ok_or_else(|| AppError::NotFound("حساب أرباح تسوية المخزون غير موجود: 331".into()))?;

        let lines = vec![
            JournalLine::new(
                inventory_account.id,
                MonetaryAmount::from_base(total_value, base_currency.clone()),
                MonetaryAmount::zero(base_currency.clone()),
                format!("تسوية جرد (فائض) - مرجع {}", reference),
            ),
            JournalLine::new(
                gain_account.id,
                MonetaryAmount::zero(base_currency.clone()),
                MonetaryAmount::from_base(total_value, base_currency.clone()),
                format!("تسوية جرد (فائض) - مرجع {}", reference),
            ),
        ];
        let entry = JournalEntry::new(
            entry_number,
            JournalType::AdjustmentJournal,
            lines,
            entry_date,
            format!("تسوية جرد (فائض) - مرجع {}", reference),
            Some(reference.to_string()),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;
        journal_repo.save(&entry).await?;
    } else {
        // Shortage: Dr 45 (خسائر المواد التالفة والتسويات), Cr 1241 (بضاعة آخر المدة)
        let loss_account = account_repo.find_by_code("45").await?
            .ok_or_else(|| AppError::NotFound("حساب خسائر المواد التالفة والتسويات غير موجود: 45".into()))?;
        let inventory_account = account_repo.find_by_code("1241").await?
            .ok_or_else(|| AppError::NotFound("حساب بضاعة آخر المدة غير موجود: 1241".into()))?;

        let lines = vec![
            JournalLine::new(
                loss_account.id,
                MonetaryAmount::from_base(total_value, base_currency.clone()),
                MonetaryAmount::zero(base_currency.clone()),
                format!("تسوية جرد (عجز) - مرجع {}", reference),
            ),
            JournalLine::new(
                inventory_account.id,
                MonetaryAmount::zero(base_currency.clone()),
                MonetaryAmount::from_base(total_value, base_currency.clone()),
                format!("تسوية جرد (عجز) - مرجع {}", reference),
            ),
        ];
        let entry = JournalEntry::new(
            entry_number,
            JournalType::AdjustmentJournal,
            lines,
            entry_date,
            format!("تسوية جرد (عجز) - مرجع {}", reference),
            Some(reference.to_string()),
        ).map_err(|e| AppError::Invalid(e.to_string()))?;
        journal_repo.save(&entry).await?;
    }
    Ok(())
}

pub fn to_dto(a: StockAdjustment, material_name: String) -> StockAdjustmentDto {
    let diff = a.difference;
    let unit_cost_base = if diff != Decimal::ZERO {
        a.unit_cost / diff.abs()
    } else {
        Decimal::ZERO
    };
    StockAdjustmentDto {
        id: a.id.to_string(),
        material_id: a.material_id.to_string(),
        material_name: Some(material_name),
        system_quantity: a.system_quantity.to_string(),
        actual_quantity: a.actual_quantity.to_string(),
        difference: diff.to_string(),
        reason: a.reason,
        unit_cost: unit_cost_base.to_string(),
        unit_cost_base: unit_cost_base.to_string(),
        total_cost: a.unit_cost.to_string(),
        total_cost_base: a.unit_cost.to_string(),
        notes: a.notes,
        reference: a.reference,
        adjustment_date: a.adjustment_date.to_rfc3339(),
        created_at: a.created_at.to_rfc3339(),
    }
}
