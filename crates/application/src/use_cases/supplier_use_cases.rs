use std::sync::Arc;
use domain::suppliers::Supplier;
use crate::ports::supplier_repository::SupplierRepository;
use crate::dto::supplier_dto::{CreateSupplierRequest, SupplierDto};
use crate::errors::AppError;

pub struct CreateSupplierUseCase {
    repo: Arc<dyn SupplierRepository>,
}

impl CreateSupplierUseCase {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateSupplierRequest) -> Result<SupplierDto, AppError> {
        let supplier = Supplier::new(req.name, req.phone, req.email, req.address)
            .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save(&supplier).await?;
        Ok(SupplierDto {
            id: supplier.id.to_string(),
            name: supplier.name,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            balance: supplier.balance.to_string(),
            is_active: supplier.is_active,
            created_at: supplier.created_at.to_rfc3339(),
            updated_at: supplier.updated_at.to_rfc3339(),
        })
    }
}

pub struct ListSuppliersUseCase {
    repo: Arc<dyn SupplierRepository>,
}

impl ListSuppliersUseCase {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self) -> Result<Vec<SupplierDto>, AppError> {
        let suppliers = self.repo.list_all().await?;
        Ok(suppliers.into_iter().map(|s| SupplierDto {
            id: s.id.to_string(),
            name: s.name,
            phone: s.phone,
            email: s.email,
            address: s.address,
            balance: s.balance.to_string(),
            is_active: s.is_active,
            created_at: s.created_at.to_rfc3339(),
            updated_at: s.updated_at.to_rfc3339(),
        }).collect())
    }
}

pub struct GetSupplierUseCase {
    repo: Arc<dyn SupplierRepository>,
}

impl GetSupplierUseCase {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<SupplierDto, AppError> {
        let sid = id.parse().map_err(|_| AppError::NotFound("Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
        let supplier = self.repo.find_by_id(&sid).await?
            .ok_or_else(|| AppError::NotFound("Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯".into()))?;
        Ok(SupplierDto {
            id: supplier.id.to_string(),
            name: supplier.name,
            phone: supplier.phone,
            email: supplier.email,
            address: supplier.address,
            balance: supplier.balance.to_string(),
            is_active: supplier.is_active,
            created_at: supplier.created_at.to_rfc3339(),
            updated_at: supplier.updated_at.to_rfc3339(),
        })
    }
}

pub struct DeleteSupplierUseCase {
    repo: Arc<dyn SupplierRepository>,
}

impl DeleteSupplierUseCase {
    pub fn new(repo: Arc<dyn SupplierRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, id: String) -> Result<(), AppError> {
        let sid = id.parse().map_err(|_| AppError::NotFound("Ù…Ø¹Ø±Ù Ø§Ù„Ù…ÙˆØ±Ø¯ ØºÙŠØ± ØµØ§Ù„Ø­".into()))?;
        self.repo.delete(&sid).await
    }
}
