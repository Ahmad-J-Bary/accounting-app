use crate::errors::AppError;
use crate::ports::stock_movement_repository::StockMovementRepository;
use domain::inventory::stock_movement::MovementType;
use std::sync::Arc;

pub struct DeleteTransferUseCase {
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl DeleteTransferUseCase {
    pub fn new(movement_repo: Arc<dyn StockMovementRepository>) -> Self {
        Self { movement_repo }
    }

    pub async fn execute(&self, reference: &str) -> Result<(), AppError> {
        let movements = self.movement_repo.list_by_reference(reference).await?;
        let has_out = movements
            .iter()
            .any(|m| matches!(m.movement_type, MovementType::Out));
        let has_in = movements
            .iter()
            .any(|m| matches!(m.movement_type, MovementType::In));
        if !has_out || !has_in {
            return Err(AppError::NotFound("التحويل غير موجود".into()));
        }
        self.movement_repo
            .delete_by_reference(reference, "Out")
            .await?;
        self.movement_repo
            .delete_by_reference(reference, "In")
            .await?;
        Ok(())
    }
}
