use std::sync::Arc;
use std::str::FromStr;
use domain::shared::ids::{SalesReturnId, CustomerId, MaterialId};
use crate::ports::sales_return_repository::SalesReturnRepository;
use crate::ports::customer_repository::CustomerRepository;
use crate::ports::material_repository::MaterialRepository;
use crate::dto::returns_dto::SalesReturnDto;
use crate::errors::AppError;

pub struct SalesReturnQueries {
    repo: Arc<dyn SalesReturnRepository>,
    customer_repo: Arc<dyn CustomerRepository>,
    material_repo: Arc<dyn MaterialRepository>,
}

impl SalesReturnQueries {
    pub fn new(
        repo: Arc<dyn SalesReturnRepository>,
        customer_repo: Arc<dyn CustomerRepository>,
        material_repo: Arc<dyn MaterialRepository>,
    ) -> Self {
        Self { repo, customer_repo, material_repo }
    }

    pub async fn list_all(&self) -> Result<Vec<SalesReturnDto>, AppError> {
        let returns = self.repo.list_all().await?;
        let mut dtos = Vec::new();
        for r in returns {
            let dto: SalesReturnDto = r.into();
            dtos.push(self.populate(dto).await?);
        }
        Ok(dtos)
    }

    pub async fn get_by_id(&self, id: String) -> Result<SalesReturnDto, AppError> {
        let rid = SalesReturnId::from_str(&id)
            .map_err(|_| AppError::Invalid("معرف المرتجع غير صالح".into()))?;
        let r = self.repo.find_by_id(&rid).await?
            .ok_or_else(|| AppError::NotFound("مرتجع المبيعات غير موجود".into()))?;
        let dto: SalesReturnDto = r.into();
        self.populate(dto).await
    }

    pub async fn populate(&self, mut dto: SalesReturnDto) -> Result<SalesReturnDto, AppError> {
        if let Ok(cid) = CustomerId::from_str(&dto.customer_id) {
            if let Ok(Some(c)) = self.customer_repo.find_by_id(&cid).await {
                dto.customer_name = Some(c.name);
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
