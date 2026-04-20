use std::sync::Arc;
use chrono::DateTime;
use rust_decimal::Decimal;
use domain::inventory::StockAdjustment;
use domain::shared::ids::ProductId;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::product_repository::ProductRepository;
use crate::dto::adjustment_dto::{CreateStockAdjustmentRequest, StockAdjustmentDto};
use crate::errors::AppError;

fn to_dto(a: StockAdjustment) -> StockAdjustmentDto {
    StockAdjustmentDto {
        id: a.id.to_string(),
        product_id: a.product_id.to_string(),
        product_name: None,
        system_quantity: a.system_quantity.to_string(),
        actual_quantity: a.actual_quantity.to_string(),
        difference: a.difference.to_string(),
        reason: a.reason,
        adjustment_date: a.adjustment_date.to_rfc3339(),
        created_at: a.created_at.to_rfc3339(),
    }
}

pub struct CreateStockAdjustmentUseCase {
    adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    product_repo: Arc<dyn ProductRepository>,
}

impl CreateStockAdjustmentUseCase {
    pub fn new(
        adjustment_repo: Arc<dyn StockAdjustmentRepository>,
        product_repo: Arc<dyn ProductRepository>,
    ) -> Self {
        Self { adjustment_repo, product_repo }
    }

    pub async fn execute(&self, req: CreateStockAdjustmentRequest) -> Result<StockAdjustmentDto, AppError> {
        let product_id = req.product_id.parse::<ProductId>()
            .map_err(|_| AppError::Invalid("Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;

        let product = self.product_repo.find_by_id(&product_id).await?
            .ok_or_else(|| AppError::NotFound("Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯".into()))?;

        let actual_quantity = Decimal::try_from(req.actual_quantity)
            .map_err(|_| AppError::Invalid("Ø§Ù„ÙƒÙ…ÙŠØ© Ø§Ù„ÙØ¹Ù„ÙŠØ© ØºÙŠØ± ØµØ§Ù„Ø­Ø©".into()))?;

        let adjustment_date = DateTime::parse_from_rfc3339(&req.adjustment_date)
            .map_err(|_| AppError::Invalid("Ø§Ù„ØªØ§Ø±ÙŠØ® ØºÙŠØ± ØµØ§Ù„Ø­".into()))?
            .with_timezone(&chrono::Utc);

        let adjustment = StockAdjustment::new(
            product_id,
            product.stock_quantity,
            actual_quantity,
            req.reason,
            adjustment_date,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.adjustment_repo.save(&adjustment).await?;
        Ok(to_dto(adjustment))
    }
}

pub struct ListStockAdjustmentsUseCase {
    repo: Arc<dyn StockAdjustmentRepository>,
}

impl ListStockAdjustmentsUseCase {
    pub fn new(repo: Arc<dyn StockAdjustmentRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<StockAdjustmentDto>, AppError> {
        Ok(self.repo.list_all().await?.into_iter().map(to_dto).collect())
    }
}
