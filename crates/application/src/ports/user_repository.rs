use crate::errors::AppError;
use async_trait::async_trait;
use domain::auth::{Role, User};
use domain::shared::ids::{RoleId, UserId};

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn save(&self, user: &User) -> Result<(), AppError>;
    async fn find_by_id(&self, id: &UserId) -> Result<Option<User>, AppError>;
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, AppError>;
    async fn list_all(&self) -> Result<Vec<User>, AppError>;
    async fn update(&self, user: &User) -> Result<(), AppError>;
    async fn delete(&self, id: &UserId) -> Result<(), AppError>;
    async fn save_role(&self, role: &Role) -> Result<(), AppError>;
    async fn find_role_by_id(&self, id: &RoleId) -> Result<Option<Role>, AppError>;
    async fn list_roles(&self) -> Result<Vec<Role>, AppError>;
    async fn update_role(&self, role: &Role) -> Result<(), AppError>;
    async fn delete_role(&self, id: &RoleId) -> Result<(), AppError>;
}
