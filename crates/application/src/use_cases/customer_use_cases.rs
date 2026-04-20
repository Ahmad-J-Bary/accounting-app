use std::sync::Arc;
use domain::customers::Customer;
use crate::ports::customer_repository::CustomerRepository;
use crate::dto::customer_dto::{CreateCustomerRequest, UpdateCustomerRequest, CustomerDto};
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

pub struct UpdateCustomerUseCase {
    repo: Arc<dyn CustomerRepository>,
}

impl UpdateCustomerUseCase {
    pub fn new(repo: Arc<dyn CustomerRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: UpdateCustomerRequest) -> Result<CustomerDto, AppError> {
        let cid = req.id.parse().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        let mut customer = self.repo.find_by_id(&cid).await?
            .ok_or_else(|| AppError::NotFound("العميل غير موجود".into()))?;
        
        customer.update_info(req.name, req.phone, req.email, req.address)
            .map_err(|e| AppError::Invalid(e.to_string()))?;
        
        if req.is_active {
            customer.activate();
        } else {
            customer.deactivate();
        }

        self.repo.update(&customer).await?;
        Ok(CustomerDto::from(customer))
    }
}

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
        let cid = id.parse().map_err(|_| AppError::NotFound("معرف العميل غير صالح".into()))?;
        self.repo.delete(&cid).await
    }
}
