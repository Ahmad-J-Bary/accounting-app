use crate::errors::AppError;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::shared::ids::DamagedItemId;
use std::sync::Arc;

pub struct DeleteDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeleteDamagedItemUseCase {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { repo, movement_repo, journal_repo }
    }

    pub async fn execute(&self, id: &str) -> Result<(), AppError> {
        let damaged_id = id
            .parse::<DamagedItemId>()
            .map_err(|_| AppError::Invalid("معرف التالف غير صالح".into()))?;

        let item = self
            .repo
            .find_by_id(&damaged_id)
            .await?
            .ok_or_else(|| AppError::NotFound("سجل التالف غير موجود".into()))?;

        let reference = item.reference.clone().unwrap_or_else(|| format!("DAM-{}", id));

        // Delete journal entry — drafts only; posted entries are immutable.
        let entry = self.journal_repo.find_by_source_id(&reference).await?;
        if let Some(entry) = entry {
            crate::use_cases::journal::guards::ensure_deletable(std::slice::from_ref(&entry))?;
            self.journal_repo.delete(&entry.id).await?;
        }

        self.movement_repo.delete_by_reference(&reference, "Damaged").await?;

        self.repo.delete(&damaged_id).await?;

        Ok(())
    }
}
