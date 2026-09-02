use crate::errors::AppError;
use async_trait::async_trait;

#[async_trait]
pub trait AppConfigRepository: Send + Sync {
    async fn get(&self, key: &str) -> Result<Option<String>, AppError>;
    async fn set(&self, key: &str, value: &str) -> Result<(), AppError>;
    async fn delete(&self, key: &str) -> Result<(), AppError>;
}
