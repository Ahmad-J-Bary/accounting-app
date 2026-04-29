use async_trait::async_trait;
use sqlx::SqlitePool;
use application::errors::AppError;
use application::ports::user_repository::UserRepository;
use domain::auth::{User, Role};
use domain::shared::ids::{UserId, RoleId};
use std::sync::Arc;

mod models;
mod mappers;
mod queries;
mod commands;

pub struct SqliteUserRepository {
    pool: Arc<SqlitePool>,
}

impl SqliteUserRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for SqliteUserRepository {
    async fn save(&self, user: &User) -> Result<(), AppError> {
        commands::save(&self.pool, user).await
    }

    async fn find_by_id(&self, id: &UserId) -> Result<Option<User>, AppError> {
        queries::find_by_id(&self.pool, id).await
    }

    async fn find_by_username(&self, username: &str) -> Result<Option<User>, AppError> {
        queries::find_by_username(&self.pool, username).await
    }

    async fn list_all(&self) -> Result<Vec<User>, AppError> {
        queries::list_all(&self.pool).await
    }

    async fn update(&self, user: &User) -> Result<(), AppError> {
        commands::update(&self.pool, user).await
    }

    async fn delete(&self, id: &UserId) -> Result<(), AppError> {
        commands::delete(&self.pool, id).await
    }

    async fn save_role(&self, role: &Role) -> Result<(), AppError> {
        commands::save_role(&self.pool, role).await
    }

    async fn find_role_by_id(&self, id: &RoleId) -> Result<Option<Role>, AppError> {
        queries::find_role_by_id(&self.pool, id).await
    }

    async fn list_roles(&self) -> Result<Vec<Role>, AppError> {
        queries::list_roles(&self.pool).await
    }

    async fn update_role(&self, role: &Role) -> Result<(), AppError> {
        commands::update_role(&self.pool, role).await
    }

    async fn delete_role(&self, id: &RoleId) -> Result<(), AppError> {
        commands::delete_role(&self.pool, id).await
    }
}
