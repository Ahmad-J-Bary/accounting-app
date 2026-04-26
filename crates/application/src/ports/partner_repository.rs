use domain::accounting::partner::Partner;
use domain::shared::ids::PartnerId;
use crate::errors::AppError;
use async_trait::async_trait;

#[async_trait]
pub trait PartnerRepository: Send + Sync {
    async fn find_by_id(&self, id: &PartnerId) -> Result<Option<Partner>, AppError>;
    async fn list_all(&self, include_inactive: bool) -> Result<Vec<Partner>, AppError>;
    async fn save(&self, partner: &Partner) -> Result<(), AppError>;
    async fn update(&self, partner: &Partner) -> Result<(), AppError>;
    async fn delete(&self, id: &PartnerId) -> Result<(), AppError>;
}
