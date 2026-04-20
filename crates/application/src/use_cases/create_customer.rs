use std::sync::Arc;
use domain::customers::Customer;
use crate::ports::customer_repository::CustomerRepository;
use crate::dto::customer_dto::{CreateCustomerRequest, CustomerDto};
use crate::errors::AppError;

pub struct CreateCustomerUseCase {
    repo: Arc<dyn CustomerRepository>,
}

impl CreateCustomerUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateCustomerRequest) -> Result<CustomerDto, AppError> {
        let customer = Customer::new(
            req.name,
            req.phone,
            req.email,
            req.address,
        ).map_err(|e| AppError::Invalid(e.to_string()))?;

        self.repo.save(&customer).await?;

        Ok(CustomerDto::from(customer))
    }
}
