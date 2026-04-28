use std::sync::Arc;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::material_dto::{UpdateMaterialRequest, MaterialDto};
use crate::errors::AppError;

pub struct UpdateMaterialUseCase {
    repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
}

impl UpdateMaterialUseCase {
    pub fn new(
        repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
    ) -> Self {
        Self { repo, movement_repo }
    }

    pub async fn execute(&self, req: UpdateMaterialRequest) -> Result<MaterialDto, AppError> {
        let mid = req.id.parse().map_err(|_| AppError::NotFound("معرف المادة غير صالح".into()))?;
        let mut material = self.repo.find_by_id(&mid).await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;
        
        material.name = req.name;
        material.barcode = req.barcode;
        material.code = req.code;
        material.minimum_stock = req.minimum_stock.parse().map_err(|_| AppError::Invalid("حد الطلب غير صالح".into()))?;
        
        let mut category_ids = vec![];
        for cid_str in req.category_ids {
            let cid = cid_str.parse().map_err(|_| AppError::Invalid("معرف تصنيف غير صالح".into()))?;
            category_ids.push(cid);
        }
        material.category_ids = category_ids;

        if req.is_active {
            material.activate();
        } else {
            material.deactivate();
        }

        self.repo.update(&material).await?;
        
        let mut dto = MaterialDto::from(material);
        let balance = self.movement_repo.get_stock_balance(&mid).await?;
        dto.stock_quantity = balance.to_string();
        
        Ok(dto)
    }
}
