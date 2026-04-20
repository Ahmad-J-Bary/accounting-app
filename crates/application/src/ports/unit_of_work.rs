use async_trait::async_trait;
use crate::errors::AppError;

#[async_trait]
pub trait UnitOfWork: Send + Sync {
    async fn begin(&self) -> Result<(), AppError>;
    async fn commit(&self) -> Result<(), AppError>;
    async fn rollback(&self) -> Result<(), AppError>;
}
