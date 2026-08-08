use std::sync::Arc;
use crate::ports::journal_entry_repository::JournalEntryRepository;
use crate::ports::stock_adjustment_repository::StockAdjustmentRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::shared::ids::StockAdjustmentId;
use crate::errors::AppError;

pub struct DeleteStockAdjustmentUseCase {
    adjustment_repo: Arc<dyn StockAdjustmentRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    journal_repo: Arc<dyn JournalEntryRepository>,
}

impl DeleteStockAdjustmentUseCase {
    pub fn new(
        adjustment_repo: Arc<dyn StockAdjustmentRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        journal_repo: Arc<dyn JournalEntryRepository>,
    ) -> Self {
        Self { adjustment_repo, movement_repo, journal_repo }
    }

    pub async fn execute(&self, id: &str) -> Result<(), AppError> {
        let adjustment_id = id
            .parse::<StockAdjustmentId>()
            .map_err(|_| AppError::Invalid("معرف التسوية غير صالح".into()))?;

        let adjustment = self
            .adjustment_repo
            .find_by_id(&adjustment_id)
            .await?
            .ok_or_else(|| AppError::NotFound("التسوية غير موجودة".into()))?;

        let reference = adjustment.reference.clone().unwrap_or_else(|| adjustment.id.to_string());

        // Delete journal entry — drafts only; posted entries are immutable.
        let entry = self.journal_repo.find_by_source_id(&reference).await?;
        if let Some(entry) = entry {
            crate::use_cases::journal::guards::ensure_deletable(std::slice::from_ref(&entry))?;
            self.journal_repo.delete(&entry.id).await?;
        }

        self.movement_repo.delete_by_reference(&reference, "Adjustment").await?;

        self.adjustment_repo.delete(&adjustment_id).await?;

        Ok(())
    }
}
