use std::sync::Arc;
use domain::inventory::material::Material;
use domain::shared::money::Money;
use domain::shared::ids::MaterialCategoryId;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::stock_movement_repository::StockMovementRepository;
use crate::ports::category_repository::CategoryRepository;
use crate::dto::material_dto::{CreateMaterialRequest, UpdateMaterialRequest, MaterialDto};
use crate::errors::AppError;
use rust_decimal::Decimal;
use std::str::FromStr;

fn parse_optional_money(val: &Option<String>) -> Result<Option<Money>, AppError> {
    match val {
        Some(s) if !s.trim().is_empty() => {
            let amount = Decimal::from_str(s).map_err(|_| AppError::Invalid("سعر غير صالح".into()))?;
            Ok(Some(Money::syp(amount)))
        }
        _ => Ok(None),
    }
}

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
        let purchase_price = parse_optional_money(&req.purchase_price)?;
        let retail_price = parse_optional_money(&req.retail_price)?;
        let wholesale_price = parse_optional_money(&req.wholesale_price)?;
        let semi_wholesale_price = parse_optional_money(&req.semi_wholesale_price)?;

        let minimum_stock = if req.minimum_stock.trim().is_empty() {
            Decimal::ZERO
        } else {
            Decimal::from_str(&req.minimum_stock).map_err(|_| AppError::Invalid("الحد الأدنى غير صالح".into()))?
        };

        let mut category_ids = vec![];
        for cid_str in req.category_ids {
            let cid = cid_str.parse().map_err(|_| AppError::Invalid("معرف تصنيف غير صالح".into()))?;
            category_ids.push(cid);
        }

        // If no categories provided, we should ideally assign "General"
        // But for now, we'll let the repo implementation handle it or just leave it.
        // Actually, let's find the General category if category_ids is empty.
        if category_ids.is_empty() {
             if let Some(cat) = self.category_repo.find_by_name("عام").await? {
                 category_ids.push(cat.id);
             }
        }

        let material = Material::new(
            req.name,
            req.barcode,
            req.code,
            purchase_price,
            retail_price,
            wholesale_price,
            semi_wholesale_price,
            minimum_stock,
            req.notes,
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
        
        let purchase_price = parse_optional_money(&req.purchase_price)?;
        let retail_price = parse_optional_money(&req.retail_price)?;
        let wholesale_price = parse_optional_money(&req.wholesale_price)?;
        let semi_wholesale_price = parse_optional_money(&req.semi_wholesale_price)?;

        let minimum_stock = Decimal::from_str(&req.minimum_stock).map_err(|_| AppError::Invalid("الحد الأدنى غير صالح".into()))?;

        material.name = req.name;
        material.barcode = req.barcode;
        material.code = req.code;
        material.purchase_price = purchase_price;
        material.retail_price = retail_price;
        material.wholesale_price = wholesale_price;
        material.semi_wholesale_price = semi_wholesale_price;
        material.minimum_stock = minimum_stock;
        material.notes = req.notes;
        
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
        // Check if there are movements
        let movements = self.movement_repo.list_by_material(&mid).await?;
        if !movements.is_empty() {
            return Err(AppError::Forbidden("لا يمكن حذف مادة لها حركات مخزنية".into()));
        }
        self.repo.delete(&mid).await
    }
}
