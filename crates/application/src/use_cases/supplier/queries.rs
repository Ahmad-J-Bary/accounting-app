use std::sync::Arc;
use domain::shared::ids::SupplierId;
use crate::ports::supplier_repository::SupplierRepository;
use crate::dto::supplier_dto::SupplierDto;
use crate::errors::AppError;

pub struct SupplierQueries {
    repo: Arc<dyn SupplierRepository>,
}

impl SupplierQueries {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_all(&self) -> Result<Vec<SupplierDto>, AppError> {
        let suppliers = self.repo.list_all().await?;
        Ok(suppliers.into_iter().map(SupplierDto::from).collect())
    }

    pub async fn get_by_id(&self, id: String) -> Result<SupplierDto, AppError> {
        let sid = id.parse::<u64>().map_err(|_| AppError::NotFound("معرف المورد غير صالح".into()))?;
        let sid = SupplierId::from_u64(sid);
        let supplier = self.repo.find_by_id(&sid).await?
            .ok_or_else(|| AppError::NotFound("المورد غير موجود".into()))?;

        Ok(SupplierDto::from(supplier))
    }
}
