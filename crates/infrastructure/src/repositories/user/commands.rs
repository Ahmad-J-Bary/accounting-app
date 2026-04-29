use sqlx::SqlitePool;
use application::errors::AppError;
use domain::auth::{User, Role};
use domain::shared::ids::{UserId, RoleId};

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
