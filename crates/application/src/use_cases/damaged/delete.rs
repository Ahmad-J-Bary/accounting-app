use crate::errors::AppError;
use crate::ports::damaged_item_repository::DamagedItemRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::shared::ids::DamagedItemId;
use std::sync::Arc;

pub struct DeleteDamagedItemUseCase {
    repo: Arc<dyn DamagedItemRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl DeleteDamagedItemUseCase {
    pub fn new(
        repo: Arc<dyn DamagedItemRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, movement_repo }
    }

    pub async fn execute(&self, id: &str) -> Result<(), AppError> {
        let damaged_id = id
            .parse::<DamagedItemId>()
            .map_err(|_| AppError::Invalid("معرف التالف غير صالح".into()))?;

        // Delete related stock movement first
        let reference = format!("DAM-{}", id);
        self.movement_repo.delete_by_reference(&reference, "Damaged").await?;

        // Delete the damaged item record
        self.repo.delete(&damaged_id).await?;

        Ok(())
    }
}
