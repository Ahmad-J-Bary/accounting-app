use async_trait::async_trait;
use domain::shared::ProductId;
use domain::inventory::product::Product;
use crate::errors::AppError;

#[async_trait]
pub trait ProductRepository: Send + Sync {
    async fn save(&self, product: &Product) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &ProductId) -> Result<Option<Product>, AppError>;
    async fn list_all(&self) -> Result<Vec<Product>, AppError>;
    async fn update(&self, product: &Product) -> Result<(), AppError>;
    async fn delete(&self, id: &ProductId) -> Result<(), AppError>;
}
