use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::code_prefix_repository::CodePrefixRepository;
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteCodePrefixRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteCodePrefixRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CodePrefixRepository for SqliteCodePrefixRepository {
    async fn get_next_sequence(&self, category_id: &str) -> Result<u64, AppError> {
        commands::get_next_sequence(&self.pool, category_id).await
    }
}
