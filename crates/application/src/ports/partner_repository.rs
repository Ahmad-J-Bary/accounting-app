use domain::accounting::partner::Partner;
use domain::accounting::account::Account;
use domain::shared::ids::PartnerId;
use crate::errors::AppError;
use async_trait::async_trait;

#[async_trait]
pub trait PartnerRepository: Send + Sync {
    async fn find_by_id(&self, id: &PartnerId) -> Result<Option<Partner>, AppError>;
    async fn list_all(&self, include_inactive: bool) -> Result<Vec<Partner>, AppError>;
    async fn save(&self, partner: &Partner) -> Result<(), AppError>;
    /// Atomically persists a partner together with its created capital and
    /// drawings accounts (and optional current/profit account) in ONE
    /// transaction: either every row is written or none is (Sec 14 / Sec 29).
    async fn save_with_accounts(
        &self,
        partner: &Partner,
        capital_account: &Account,
        drawings_account: &Account,
        current_account: Option<&Account>,
    ) -> Result<(), AppError>;
    async fn update(&self, partner: &Partner) -> Result<(), AppError>;
    async fn delete(&self, id: &PartnerId) -> Result<(), AppError>;
}
