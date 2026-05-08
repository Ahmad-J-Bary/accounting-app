use crate::dto::damaged_dto::{CreateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;
use crate::ports::account_repository::AccountRepository;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use chrono::{DateTime, Utc};
use domain::accounting::journal_entry::{JournalEntry, JournalLine};
use domain::inventory::stock_movement::{MovementType, StockMovement};
use domain::inventory::DamagedItem;
use domain::shared::currency::Currency;
use domain::shared::ids::MaterialId;
use domain::shared::monetary_amount::MonetaryAmount;
use domain::shared::money::Money;
use rust_decimal::Decimal;
use std::sync::Arc;

pub struct CreateDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
    account_repo: Arc<dyn AccountRepository>,
}

impl CreateDamagedItemUseCase {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
        account_repo: Arc<dyn AccountRepository>,
    ) -> Self {
        Self {
            repo,
            material_repo,
            movement_repo,
            journal_repo,
            account_repo,
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
        let cost_impact = Decimal::try_from(req.cost_impact)
            .map_err(|_| AppError::Invalid("قيمة التكلفة غير صالحة".into()))?;
        let damage_date = DateTime::parse_from_rfc3339(&req.damage_date)
            .map_err(|_| AppError::Invalid("التاريخ غير صالح".into()))?
            .with_timezone(&Utc);

        let item = DamagedItem::new(
            material_id,
            quantity,
            req.reason.clone(),
            damage_date,
            cost_impact,
            req.notes,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save(&item).await?;

        let unit_cost = if quantity > Decimal::ZERO {
            cost_impact / quantity
        } else {
            Decimal::ZERO
        };
        let movement = StockMovement::new(
            item.material_id.clone(),
            MovementType::Damaged,
            quantity,
            unit_cost,
            cost_impact,
            format!("DAM-{}", item.id),
            req.reason.clone(),
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.movement_repo.save(&movement).await?;

        if cost_impact > Decimal::ZERO {
            let loss_account = self.account_repo.find_by_code("43").await?.ok_or_else(|| {
                AppError::NotFound("حساب مصاريف أخرى (43) غير موجود".into())
            })?;
            let inventory_account =
                self.account_repo
                    .find_by_code("1204")
                    .await?
                    .ok_or_else(|| {
                        AppError::NotFound("حساب المخزون (1204) غير موجود".into())
                    })?;

            let lines = vec![
                JournalLine::new(
                    loss_account.id,
                    MonetaryAmount::new(Money::syp(cost_impact), Decimal::ONE),
                    MonetaryAmount::zero(Currency::syp()),
                    format!("خسارة تلف: {} - {}", material.name, req.reason),
                ),
                JournalLine::new(
                    inventory_account.id,
                    MonetaryAmount::zero(Currency::syp()),
                    MonetaryAmount::new(Money::syp(cost_impact), Decimal::ONE),
                    format!("تخفيض مخزون بسبب تلف: {}", material.name),
                ),
            ];

            let mut entry = JournalEntry::new(
                format!("JE-DAM-{}", Utc::now().timestamp()),
                lines,
                damage_date,
                format!("قيد تلف مواد: {} - {}", material.name, req.reason),
            )
            .map_err(|e| AppError::Invalid(e.to_string()))?;

            entry.post().map_err(|e| AppError::Invalid(e.to_string()))?;
            self.journal_repo.save(&entry).await?;
        }

        Ok(to_dto(item))
    }
}

pub fn to_dto(d: DamagedItem) -> DamagedItemDto {
    DamagedItemDto {
        id: d.id.to_string(),
        material_id: d.material_id.to_string(),
        material_name: None,
        quantity: d.quantity.to_string(),
        reason: d.reason,
        damage_date: d.damage_date.to_rfc3339(),
        cost_impact: d.cost_impact.to_string(),
        notes: d.notes,
        created_at: d.created_at.to_rfc3339(),
    }
}
