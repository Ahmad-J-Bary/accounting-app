use application::errors::AppError;
use domain::auth::{Role, User};
use domain::shared::ids::{RoleId, UserId};
use sqlx::SqlitePool;

pub async fn save(_pool: &SqlitePool, _user: &User) -> Result<(), AppError> {
    Ok(())
}

pub async fn update(_pool: &SqlitePool, _user: &User) -> Result<(), AppError> {
    Ok(())
}

pub async fn delete(_pool: &SqlitePool, _id: &UserId) -> Result<(), AppError> {
    Ok(())
}

pub async fn save_role(_pool: &SqlitePool, _role: &Role) -> Result<(), AppError> {
    Ok(())
}

pub async fn update_role(_pool: &SqlitePool, _role: &Role) -> Result<(), AppError> {
    Ok(())
}

pub async fn delete_role(_pool: &SqlitePool, _id: &RoleId) -> Result<(), AppError> {
    Ok(())
}
