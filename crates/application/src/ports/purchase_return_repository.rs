use async_trait::async_trait;
use domain::returns::PurchaseReturn;
use domain::shared::ids::PurchaseReturnId;
use crate::errors::AppError;

#[async_trait]
pub trait PurchaseReturnRepository: Send + Sync {
    async fn save(&self, ret: &PurchaseReturn) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &PurchaseReturnId) -> Result<Option<PurchaseReturn>, AppError>;
    async fn list_all(&self) -> Result<Vec<PurchaseReturn>, AppError>;
    async fn get_next_return_number(&self) -> Result<String, AppError>;
}
