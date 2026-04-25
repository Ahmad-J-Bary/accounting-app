use async_trait::async_trait;
use domain::suppliers::Supplier;
use domain::shared::ids::{SupplierId, AccountId};
use crate::errors::AppError;

#[async_trait]
pub trait SupplierRepository: Send + Sync {
    async fn save(&self, supplier: &Supplier) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &SupplierId) -> Result<Option<Supplier>, AppError>;
    async fn find_by_account_id(&self, account_id: &AccountId) -> Result<Option<Supplier>, AppError>;
    async fn find_by_name(&self, name: &str) -> Result<Vec<Supplier>, AppError>;
    async fn list_all(&self) -> Result<Vec<Supplier>, AppError>;
    async fn update(&self, supplier: &Supplier) -> Result<(), AppError>;
    async fn delete(&self, id: &SupplierId) -> Result<(), AppError>;
}
