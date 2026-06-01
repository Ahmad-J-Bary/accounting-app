use async_trait::async_trait;
use domain::returns::SalesReturn;
use domain::shared::ids::SalesReturnId;
use crate::errors::AppError;

#[async_trait]
pub trait SalesReturnRepository: Send + Sync {
    async fn save(&self, ret: &SalesReturn) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &SalesReturnId) -> Result<Option<SalesReturn>, AppError>;
    async fn list_all(&self) -> Result<Vec<SalesReturn>, AppError>;
    async fn get_next_return_number(&self) -> Result<String, AppError>;
}
