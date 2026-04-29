use std::sync::Arc;
use crate::ports::user_repository::UserRepository;
use crate::dto::user_dto::{UserDto};
use crate::errors::AppError;
use super::create::user_to_dto;

pub struct UserQueries {
    repo: Arc<dyn UserRepository>,
}

impl UserQueries {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_all(&self) -> Result<Vec<UserDto>, AppError> {
        Ok(self.repo.list_all().await?.into_iter().map(user_to_dto).collect())
    }
}
