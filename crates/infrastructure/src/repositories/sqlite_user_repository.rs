use async_trait::async_trait;
use sqlx::SqlitePool;
use std::sync::Arc;
use application::errors::AppError;
use application::ports::user_repository::UserRepository;
use domain::auth::{User, Role};
use domain::shared::ids::{UserId, RoleId};

pub struct SqliteUserRepository {
    #[allow(dead_code)]
    pool: Arc<SqlitePool>,
}

impl SqliteUserRepository {
    pub fn new(pool: Arc<SqlitePool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for SqliteUserRepository {
    async fn save(&self, _user: &User) -> Result<(), AppError> {
        // Stub implementation
        Ok(())
    }

    async fn find_by_id(&self, _id: &UserId) -> Result<Option<User>, AppError> {
        Ok(None)
    }

    async fn find_by_username(&self, _username: &str) -> Result<Option<User>, AppError> {
        Ok(None)
    }

    async fn list_all(&self) -> Result<Vec<User>, AppError> {
        Ok(vec![])
    }

    async fn update(&self, _user: &User) -> Result<(), AppError> {
        Ok(())
    }

    async fn delete(&self, _id: &UserId) -> Result<(), AppError> {
        Ok(())
    }

    async fn save_role(&self, _role: &Role) -> Result<(), AppError> {
        Ok(())
    }

    async fn find_role_by_id(&self, _id: &RoleId) -> Result<Option<Role>, AppError> {
        Ok(None)
    }

    async fn list_roles(&self) -> Result<Vec<Role>, AppError> {
        Ok(vec![])
    }

    async fn update_role(&self, _role: &Role) -> Result<(), AppError> {
        Ok(())
    }

    async fn delete_role(&self, _id: &RoleId) -> Result<(), AppError> {
        Ok(())
    }
}
