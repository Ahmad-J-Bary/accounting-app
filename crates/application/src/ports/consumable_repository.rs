use async_trait::async_trait;
use domain::assets::{Consumable, ConsumableId};
use crate::errors::AppError;

#[async_trait]
pub trait ConsumableRepository: Send + Sync {
    async fn save(&self, consumable: &Consumable) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &ConsumableId) -> Result<Option<Consumable>, AppError>;
    async fn list_all(&self) -> Result<Vec<Consumable>, AppError>;
    async fn delete(&self, id: &ConsumableId) -> Result<(), AppError>;
}
