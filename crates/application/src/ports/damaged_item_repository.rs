use crate::errors::AppError;
use async_trait::async_trait;
use domain::accounting::journal_entry::JournalEntry;
use domain::inventory::stock_movement::StockMovement;
use domain::inventory::DamagedItem;
use domain::shared::ids::DamagedItemId;

#[async_trait]
pub trait DamagedItemRepository: Send + Sync {
    async fn save(&self, item: &DamagedItem) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &DamagedItemId) -> Result<Option<DamagedItem>, AppError>;
    async fn list_all(&self) -> Result<Vec<DamagedItem>, AppError>;
    async fn delete(&self, id: &DamagedItemId) -> Result<(), AppError>;
    async fn count(&self) -> Result<i64, AppError>;
    async fn get_next_reference(&self) -> Result<String, AppError>;
    async fn save_with_accounting(
        &self,
        item: &DamagedItem,
        movements: &[StockMovement],
        entries: &[JournalEntry],
        delete_movement_reference: Option<&str>,
        delete_entries: &[domain::shared::ids::JournalEntryId],
    ) -> Result<(), AppError>;
}
