use std::sync::Arc;
use chrono::Utc;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::dto::material_dto::{UpdateMaterialRequest, MaterialDto};
use crate::errors::AppError;
use super::pricing::{build_purchase_prices, build_sale_prices, resolve_default_unit_id};

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
        material.name_en = req.name_en;
        material.barcode = req.barcode;
        material.code = req.code;
        material.minimum_stock = req.minimum_stock.parse().map_err(|_| AppError::Invalid("حد الطلب غير صالح".into()))?;
        material.notes = req.notes;
        material.image_path = req.image_path;
        material.default_purchase_unit_id = resolve_default_unit_id(req.default_purchase_unit_id, &material.units)?;
        material.default_sale_unit_id = resolve_default_unit_id(req.default_sale_unit_id, &material.units)?;

        let mut category_ids = vec![];
        for cid_str in req.category_ids {
            let cid = cid_str.parse().map_err(|_| AppError::Invalid("معرف تصنيف غير صالح".into()))?;
            category_ids.push(cid);
        }
        material.category_ids = category_ids;

        material.purchase_prices = build_purchase_prices(req.purchase_prices, &material.units)?;
        material.sale_prices = build_sale_prices(req.sale_prices, &material.units)?;
        material.updated_at = Utc::now();

        self.repo.update(&material).await?;
        
        let mut dto = MaterialDto::from(material);
        let summary = self.movement_repo.get_material_summary(&mid).await?;
        dto.total_received = summary.total_received.to_string();
        dto.total_sold = summary.total_sold.to_string();
        dto.total_available = summary.total_available.to_string();
        dto.total_damaged = summary.total_damaged.to_string();
        dto.last_purchase_price = summary.last_purchase_price.to_string();
        dto.last_sale_price = summary.last_sale_price.to_string();
        dto.average_cost = summary.average_cost.to_string();
        
        Ok(dto)
    }
}
