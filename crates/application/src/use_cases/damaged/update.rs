use crate::dto::damaged_dto::{UpdateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use chrono::{DateTime, Utc};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::shared::ids::{DamagedItemId, MaterialId};
use rust_decimal::Decimal;
use std::sync::Arc;
use crate::use_cases::damaged::create::{to_dto, create_damaged_journal_entry};

pub struct UpdateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    account_repo: Arc<dyn AccountRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl UpdateDamagedItemUseCase {
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
        let damage_date = DateTime::parse_from_rfc3339(&req.damage_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&Utc);

        item.material_id = material_id;
        item.quantity = quantity;
        item.reason = req.reason.clone();
        item.damage_date = damage_date;
        item.cost_impact = cost_impact;
        item.notes = req.notes;

        if item.reference.is_none() {
            let reference = self.movement_repo.get_next_inventory_reference().await?;
            item.reference = Some(reference);
        }
        let reference = item.reference.clone().unwrap_or_else(|| format!("DAM-{}", item.id));

        // Delete old journal entry — drafts only; posted entries are immutable.
        let old_entry = self.journal_repo.find_by_source_id(&reference).await?;
        if let Some(old_entry) = old_entry {
            crate::use_cases::journal::guards::ensure_deletable(std::slice::from_ref(&old_entry))?;
            self.journal_repo.delete(&old_entry.id).await?;
        }

        self.movement_repo.delete_by_reference(&reference, "Damaged").await?;

        self.repo.save(&item).await?;

        let unit_cost = if quantity > Decimal::ZERO {
            cost_impact / quantity
        } else {
            Decimal::ZERO
        };
        let movement_notes = format!("{} - رقم الفاتورة {}", req.reason, reference);
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
        self.movement_repo.save(&movement).await?;

        // Create new journal entry
        create_damaged_journal_entry(
            &self.account_repo,
            &self.journal_repo,
            cost_impact,
            &reference,
            damage_date,
        ).await?;

        Ok(to_dto(item, Some(reference)))
    }
}
