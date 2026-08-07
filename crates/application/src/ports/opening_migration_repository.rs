use async_trait::async_trait;
use domain::accounting::OpeningBalanceMigration;
use crate::errors::AppError;

#[async_trait]
pub trait OpeningMigrationRepository: Send + Sync {
    async fn create(&self, m: &OpeningBalanceMigration) -> Result<(), AppError>;
    async fn update(&self, m: &OpeningBalanceMigration) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &str) -> Result<Option<OpeningBalanceMigration>, AppError>;
    async fn find_by_cutover_date(&self, cutover_date: &str) -> Result<Vec<OpeningBalanceMigration>, AppError>;
    async fn list(&self) -> Result<Vec<OpeningBalanceMigration>, AppError>;
    async fn delete(&self, id: &str) -> Result<(), AppError>;
}