use std::sync::Arc;
use std::str::FromStr;
use domain::shared::ids::{PurchaseReturnId, SupplierId, MaterialId};
use crate::ports::purchase_return_repository::PurchaseReturnRepository;
use crate::ports::supplier_repository::SupplierRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::returns_dto::PurchaseReturnDto;
use crate::errors::AppError;

pub struct PurchaseReturnQueries {
    repo: Arc<dyn PurchaseReturnRepository>,
    supplier_repo: Arc<dyn SupplierRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl PurchaseReturnQueries {
    pub fn new(
        repo: Arc<dyn PurchaseReturnRepository>,
        supplier_repo: Arc<dyn SupplierRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, supplier_repo, material_repo }
    }

    pub async fn list_all(&self) -> Result<Vec<PurchaseReturnDto>, AppError> {
        let returns = self.repo.list_all().await?;
        let mut dtos = Vec::new();
        for r in returns {
            let dto: PurchaseReturnDto = r.into();
            dtos.push(self.populate(dto).await?);
        }
        Ok(dtos)
    }

    pub async fn get_by_id(&self, id: String) -> Result<PurchaseReturnDto, AppError> {
        let rid = PurchaseReturnId::from_str(&id)
            .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
        let r = self.repo.find_by_id(&rid).await?
            .ok_or_else(|| AppError::NotFound("مرتجع المشتريات غير موجود".into()))?;
        let dto: PurchaseReturnDto = r.into();
        self.populate(dto).await
    }

    pub async fn populate(&self, mut dto: PurchaseReturnDto) -> Result<PurchaseReturnDto, AppError> {
        if let Ok(sid) = SupplierId::from_str(&dto.supplier_id) {
            if let Ok(Some(s)) = self.supplier_repo.find_by_id(&sid).await {
                dto.supplier_name = Some(s.name);
            }
        }
        for line in &mut dto.lines {
            if let Ok(mid) = MaterialId::from_str(&line.material_id) {
                if let Ok(Some(m)) = self.material_repo.find_by_id(&mid).await {
                    line.material_name = Some(m.name);
                }
            }
        }
        Ok(dto)
    }
}
