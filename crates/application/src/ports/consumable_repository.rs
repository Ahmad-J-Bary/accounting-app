use async_trait::async_trait;
use domain::assets::{Consumable, ConsumableId, AssetMovement};
use domain::accounting::journal_entry::JournalEntry;
use crate::errors::AppError;

#[async_trait]
pub trait ConsumableRepository: Send + Sync {
    async fn save(&self, consumable: &Consumable) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &ConsumableId) -> Result<Option<Consumable>, AppError>;
    async fn list_all(&self) -> Result<Vec<Consumable>, AppError>;
    async fn delete(&self, id: &ConsumableId) -> Result<(), AppError>;
    /// Atomically saves the consumable + its asset movements + its journal
    /// entries in ONE transaction (Sec 9 atomicity).
    async fn save_with_accounting(
        &self,
        consumable: &Consumable,
        movements: &[AssetMovement],
        entries: &[JournalEntry],
    ) -> Result<(), AppError>;
}