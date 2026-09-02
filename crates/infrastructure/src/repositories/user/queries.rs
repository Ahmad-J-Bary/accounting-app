use application::errors::AppError;
use domain::auth::{Role, User};
use domain::shared::ids::{RoleId, UserId};
use sqlx::SqlitePool;

pub async fn find_by_id(_pool: &SqlitePool, _id: &UserId) -> Result<Option<User>, AppError> {
    Ok(None)
}

pub async fn find_by_username(
    _pool: &SqlitePool,
    _username: &str,
) -> Result<Option<User>, AppError> {
    Ok(None)
}

pub async fn list_all(_pool: &SqlitePool) -> Result<Vec<User>, AppError> {
    Ok(vec![])
}

pub async fn find_role_by_id(_pool: &SqlitePool, _id: &RoleId) -> Result<Option<Role>, AppError> {
    Ok(None)
}

pub async fn list_roles(_pool: &SqlitePool) -> Result<Vec<Role>, AppError> {
    Ok(vec![])
}
