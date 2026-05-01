use std::sync::Arc;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::errors::AppError;

pub struct DeleteMaterialUseCase {
    repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl DeleteMaterialUseCase {
    pub fn new(
        repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, movement_repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let mid = id.parse().map_err(|_| AppError::NotFound("معرف المادة غير صالح".into()))?;
        let movements = self.movement_repo.list_by_material(&mid).await?;
        if !movements.is_empty() {
            return Err(AppError::Forbidden("لا يمكن حذف مادة لها حركات مخزنية".into()));
        }
        self.repo.delete_material(&mid).await
    }
}
