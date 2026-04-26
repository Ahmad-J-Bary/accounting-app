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
use domain::shared::money::Money;
use rust_decimal::Decimal;
use std::sync::Arc;

fn to_dto(d: DamagedItem) -> DamagedItemDto {
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

        // 1. Save Damaged Item record
        let item = DamagedItem::new(
            material_id.clone(),
            quantity,
            req.reason.clone(),
            damage_date,
            cost_impact,
            req.notes.clone(),
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save(&item).await?;

        // 2. Record Stock Movement (Outflow)
        let movement = StockMovement::new(
            material_id.clone(),
            MovementType::Damaged,
            quantity,
            format!("DAM-{}", item.id),
            req.reason.clone(),
            damage_date,
        )
        .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.movement_repo.save(&movement).await?;

        // 3. Stock adjustment is handled by recording the movement (dynamic balance)


        // 4. Create Journal Entry (Debit: Loss, Credit: Inventory)
        if cost_impact > Decimal::ZERO {
            let loss_account = self
                .account_repo
                .find_by_code("43")
                .await?
                .ok_or_else(|| AppError::NotFound("حساب مصاريف أخرى (43) غير موجود".into()))?;
            let inventory_account = self
                .account_repo
                .find_by_code("1204")
                .await?
                .ok_or_else(|| AppError::NotFound("حساب المخزون (1204) غير موجود".into()))?;

            let lines = vec![
                JournalLine::new(
                    loss_account.id.clone(),
                    Currency::SYP,
                    Decimal::ONE,
                    Money::syp(cost_impact),
                    Money::zero(),
                    format!("خسارة تلف: {} - {}", material.name, req.reason),
                ),
                JournalLine::new(
                    inventory_account.id.clone(),
                    Currency::SYP,
                    Decimal::ONE,
                    Money::zero(),
                    Money::syp(cost_impact),
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

pub struct ListDamagedItemsUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl ListDamagedItemsUseCase {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, material_repo }
    }

    pub async fn execute(&self) -> Result<Vec<DamagedItemDto>, AppError> {
        let items = self.repo.list_all().await?;
        let mut dtos = Vec::new();

        for item in items {
            let mut dto = to_dto(item.clone());
            if let Ok(Some(material)) = self.material_repo.find_by_id(&item.material_id).await {
                dto.material_name = Some(material.name);
            }
            dtos.push(dto);
        }

        Ok(dtos)
    }
}
