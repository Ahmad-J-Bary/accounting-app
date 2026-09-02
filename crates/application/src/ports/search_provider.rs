use crate::dto::search_dto::{SearchQueryRequest, SearchResultDto};
use crate::errors::AppError;
use async_trait::async_trait;

#[async_trait]
pub trait SearchProvider: Send + Sync {
    fn provider_id(&self) -> &'static str;
    async fn search(&self, request: &SearchQueryRequest) -> Result<Vec<SearchResultDto>, AppError>;
}
