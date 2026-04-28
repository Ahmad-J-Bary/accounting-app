use async_trait::async_trait;
use crate::errors::AppError;

#[async_trait]
pub trait CodePrefixRepository: Send + Sync {
    /// Generates the next sequence for a given category ID and increments it in the database.
    /// This should be an atomic operation (e.g. returning RETURNING next_seq).
    async fn get_next_sequence(&self, category_id: &str) -> Result<u64, AppError>;
}
