use std::sync::Arc;
use crate::ports::customer_repository::CustomerRepository;
use crate::dto::customer_dto::CustomerDto;
use crate::errors::AppError;

pub struct ListCustomersUseCase {
    repo: Arc<dyn CustomerRepository>,
}

impl ListCustomersUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<CustomerDto>, AppError> {
        let customers = self.repo.list_all().await?;
        Ok(customers.into_iter().map(CustomerDto::from).collect())
    }
}

pub struct GetCustomerUseCase {
    repo: Arc<dyn CustomerRepository>,
}

impl GetCustomerUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<CustomerDto, AppError> {
        let cid = id.parse().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let customer = self.repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;

        Ok(CustomerDto::from(customer))
    }
}

pub struct DeleteCustomerUseCase {
    repo: Arc<dyn CustomerRepository>,
}

impl DeleteCustomerUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let cid = id.parse().map_err(|_| AppError::NotFound("Ù…Ø¹Ø±Ù Ø§Ù„Ø¹Ù…ÙŠÙ„ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
        self.repo.delete(&cid).await
    }
}
