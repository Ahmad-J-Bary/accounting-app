use std::sync::Arc;
use domain::auth::{User};
use domain::shared::ids::RoleId;
use crate::ports::user_repository::UserRepository;
use crate::dto::user_dto::{CreateUserRequest, UserDto};
use crate::errors::AppError;

pub struct CreateUserUseCase {
    repo: Arc<dyn UserRepository>,
}

impl CreateUserUseCase {
    pub fn new(repo: Arc<dyn UserRepository>) -> Self {
        Self { repo }
    }

    pub async fn execute(&self, req: CreateUserRequest) -> Result<UserDto, AppError> {
        let role_id: RoleId = req.role_id.parse()
            .map_err(|_| AppError::Invalid("معرف الدور غير صالح".into()))?;
        let password_hash = format!("hashed:{}", req.password);
        let user = User::new(req.username, req.full_name, password_hash, role_id)
            .map_err(|e| AppError::Invalid(e.to_string()))?;
        self.repo.save(&user).await?;
        Ok(user_to_dto(user))
    }
}

pub fn user_to_dto(u: User) -> UserDto {
    UserDto {
        id: u.id.to_string(),
        username: u.username,
        full_name: u.full_name,
        role_id: u.role_id.to_string(),
        role_name: None,
        is_active: u.is_active,
        last_login: u.last_login.map(|d| d.to_rfc3339()),
        created_at: u.created_at.to_rfc3339(),
    }
}
