use std::sync::Arc;
use crate::ports::consumable_repository::ConsumableRepository;
use domain::assets::{Consumable, ConsumableId};
use crate::errors::AppError;
use rust_decimal::Decimal;
use uuid::Uuid;

pub struct ConsumableUseCases {
    repo: Arc<dyn ConsumableRepository>,
}

impl ConsumableUseCases {
    pub fn new(repo: Arc<dyn ConsumableRepository>) -> Self {
        Self { repo }
    }

    pub async fn create_item(
        &self,
        code: String,
        name: String,
        category_id: Uuid,
        unit_cost: domain::shared::Money,
        fx_rate: Decimal,
    ) -> Result<ConsumableId, AppError> {
        let item = Consumable::new(code, name, category_id, unit_cost, fx_rate);
        self.repo.save(&item).await?;
        Ok(item.id)
    }

    pub async fn list_items(&self) -> Result<Vec<Consumable>, AppError> {
        self.repo.list_all().await
    }
}
