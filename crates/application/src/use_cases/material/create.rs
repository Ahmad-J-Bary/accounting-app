use std::sync::Arc;
use domain::inventory::material::Material;
use domain::inventory::category::DEFAULT_CATEGORY_NAME;
use crate::ports::material_repository::MaterialRepository;
use crate::ports::category_repository::CategoryRepository;
use crate::dto::material_dto::{CreateMaterialRequest, MaterialDto};
use crate::errors::AppError;
use super::pricing::{build_purchase_prices, build_sale_prices, resolve_default_unit_id};

pub struct CreateMaterialUseCase {
    repo: Arc<dyn MaterialRepository>,
    category_repo: Arc<dyn CategoryRepository>,
}

impl CreateMaterialUseCase {
    pub fn new(
        repo: Arc<dyn MaterialRepository>,
        category_repo: Arc<dyn CategoryRepository>,
    ) -> Self {
        Self { repo, category_repo }
    }

    pub async fn execute(&self, req: CreateMaterialRequest) -> Result<MaterialDto, AppError> {
        let mut category_ids = vec![];
        for cid_str in req.category_ids {
            let cid = cid_str.parse().map_err(|_| AppError::Invalid("معرف تصنيف غير صالح".into()))?;
            category_ids.push(cid);
        }

        if category_ids.is_empty() {
             if let Some(cat) = self.category_repo.find_by_name(DEFAULT_CATEGORY_NAME).await? {
                 category_ids.push(cat.id);
             }
        }

        let min_stock = crate::utils::parse_decimal(Some(&req.minimum_stock), "حد الطلب")?;
        let code = crate::utils::ensure_code(req.code, "AUTO".to_string());

        let mut unit_defs = vec![];
        for u in req.units {
            let factor = u.conversion_factor.parse().map_err(|_| AppError::Invalid(format!("معامل تعبئة غير صالح للوحدة {}", u.name)))?;
            unit_defs.push((u.name, factor, u.barcode));
        }

        let mut material = Material::new(
            req.name,
            req.barcode.unwrap_or_default(),
            code,
            min_stock,
            unit_defs,
            category_ids,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        material.name_en = req.name_en.unwrap_or_default();
        material.notes = req.notes;
        material.image_path = req.image_path;
        material.default_purchase_unit_id = resolve_default_unit_id(req.default_purchase_unit_id, &material.units)?;
        material.default_sale_unit_id = resolve_default_unit_id(req.default_sale_unit_id, &material.units)?;
        material.purchase_prices = build_purchase_prices(req.purchase_prices, &material.units)?;
        material.sale_prices = build_sale_prices(req.sale_prices, &material.units)?;

        self.repo.save(&material).await?;

        let dto = MaterialDto::from(material);
        Ok(dto)
    }
}
