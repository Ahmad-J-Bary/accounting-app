use std::sync::Arc;
use domain::inventory::material::Material;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::category_repository::CategoryRepository;
use crate::dto::material_dto::{CreateMaterialRequest, UpdateMaterialRequest, MaterialDto};
use crate::errors::AppError;

pub struct MaterialUseCases {
    repo: Arc<dyn MaterialRepository>,
    movement_repo: Arc<dyn StockMovementRepository>,
    category_repo: Arc<dyn CategoryRepository>,
}

impl MaterialUseCases {
    pub fn new(
        repo: Arc<dyn MaterialRepository>,
        movement_repo: Arc<dyn StockMovementRepository>,
        category_repo: Arc<dyn CategoryRepository>,
    ) -> Self {
        Self { repo, movement_repo, category_repo }
    }

    pub async fn create(&self, req: CreateMaterialRequest) -> Result<MaterialDto, AppError> {
        let mut category_ids = vec![];
        for cid_str in req.category_ids {
            let cid = cid_str.parse().map_err(|_| AppError::Invalid("معرف تصنيف غير صالح".into()))?;
            category_ids.push(cid);
        }

        if category_ids.is_empty() {
             if let Some(cat) = self.category_repo.find_by_name("عام").await? {
                 category_ids.push(cat.id);
             }
        }

        let min_stock = req.minimum_stock.parse().map_err(|_| AppError::Invalid("حد الطلب غير صالح".into()))?;

        let material = Material::new(
            req.name,
            req.barcode,
            req.code,
            min_stock,
            category_ids,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&material).await?;

        let mut dto = MaterialDto::from(material);
        dto.stock_quantity = "0".to_string();
        Ok(dto)
    }

    pub async fn update(&self, req: UpdateMaterialRequest) -> Result<MaterialDto, AppError> {
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

    pub async fn list_all(&self) -> Result<Vec<MaterialDto>, AppError> {
        let materials = self.repo.list_all().await?;
        let mut dtos = vec![];
        for m in materials {
            let mid = m.id.clone();
            let mut dto = MaterialDto::from(m);
            let balance = self.movement_repo.get_stock_balance(&mid).await?;
            dto.stock_quantity = balance.to_string();
            dtos.push(dto);
        }
        Ok(dtos)
    }

    pub async fn get_by_id(&self, id: String) -> Result<MaterialDto, AppError> {
        let mid = id.parse().map_err(|_| AppError::NotFound("معرف المادة غير صالح".into()))?;
        let material = self.repo.find_by_id(&mid).await?
            .ok_or_else(|| AppError::NotFound("المادة غير موجودة".into()))?;

        let mut dto = MaterialDto::from(material);
        let balance = self.movement_repo.get_stock_balance(&mid).await?;
        dto.stock_quantity = balance.to_string();
        Ok(dto)
    }

    pub async fn delete(&self, id: String) -> Result<(), AppError> {
        let mid = id.parse().map_err(|_| AppError::NotFound("معرف المادة غير صالح".into()))?;
        let movements = self.movement_repo.list_by_material(&mid).await?;
        if !movements.is_empty() {
            return Err(AppError::Forbidden("لا يمكن حذف مادة لها حركات مخزنية".into()));
        }
        self.repo.delete(&mid).await
    }
}
