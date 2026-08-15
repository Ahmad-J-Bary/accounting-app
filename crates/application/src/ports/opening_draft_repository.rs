use async_trait::async_trait;
use crate::errors::AppError;

/// Stores/reads a single resumable opening-balance wizard draft (the frontend
/// editor state serialized as JSON). Deliberately not a business entity: it
/// only preserves mid-wizard progress so Save -> Exit -> Continue Later works.
#[async_trait]
pub trait OpeningDraftRepository: Send + Sync {
    async fn get(&self) -> Result<Option<String>, AppError>;
    async fn save(&self, data: &str) -> Result<(), AppError>;
    async fn clear(&self) -> Result<(), AppError>;
}