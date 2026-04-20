use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::inventory::DamagedItem;
use domain::shared::ids::ProductId;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::dto::damaged_dto::{CreateDamagedItemRequest, DamagedItemDto};
use crate::errors::AppError;

fn to_dto(d: DamagedItem) -> DamagedItemDto {
    DamagedItemDto {
        id: d.id.to_string(),
        product_id: d.product_id.to_string(),
        product_name: None,
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
}

impl CreateDamagedItemUseCase {
    pub fn new(repo: Arc<dyn DamagedItemRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateDamagedItemRequest) -> Result<DamagedItemDto, AppError> {
        let product_id = req.product_id.parse::<ProductId>()
            .map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
        let quantity = Decimal::try_from(req.quantity)
            .map_err(|_| AppError::Invalid("Ø§Ù„ÙƒÙ…ÙŠØ© ØºÙŠØ± ØµØ§Ù„Ø­Ø©".into()))?;
        let cost_impact = Decimal::try_from(req.cost_impact)
            .map_err(|_| AppError::Invalid("Ù‚ÙŠÙ…Ø© Ø§Ù„ØªÙƒÙ„ÙØ© ØºÙŠØ± ØµØ§Ù„Ø­Ø©".into()))?;
        let damage_date = DateTime::parse_from_rfc3339(&req.damage_date)
            .map_err(|_| AppError::Invalid("Ø§Ù„ØªØ§Ø±ÙŠØ® ØºÙŠØ± ØµØ§Ù„Ø­".into()))?
            .with_timezone(&chrono::Utc);

        let item = DamagedItem::new(product_id, quantity, req.reason, damage_date, cost_impact, req.notes)
            .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save(&item).await?;
        Ok(to_dto(item))
    }
}

pub struct ListDamagedItemsUseCase {
    repo: Arc<dyn DamagedItemRepository>,
}

impl ListDamagedItemsUseCase {
    pub fn new(repo: Arc<dyn DamagedItemRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<DamagedItemDto>, AppError> {
        Ok(self.repo.list_all().await?.into_iter().map(to_dto).collect())
    }
}
