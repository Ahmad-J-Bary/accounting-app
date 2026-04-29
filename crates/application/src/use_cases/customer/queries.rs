use std::sync::Arc;
use domain::shared::ids::CustomerId;
use crate::ports::customer_repository::CustomerRepository;
use crate::dto::customer_dto::CustomerDto;
use crate::errors::AppError;

pub struct CustomerQueries {
    repo: Arc<dyn CustomerRepository>,
}

impl CustomerQueries {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_all(&self) -> Result<Vec<CustomerDto>, AppError> {
        let customers = self.repo.list_all().await?;
        Ok(customers.into_iter().map(CustomerDto::from).collect())
    }

    pub async fn get_by_id(&self, id: String) -> Result<CustomerDto, AppError> {
        let cid = id.parse::<CustomerId>().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let customer = self.repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;

        Ok(CustomerDto::from(customer))
    }
}
