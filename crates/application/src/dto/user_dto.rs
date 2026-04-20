use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
    pub is_system_role: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDto {
    pub id: String,
    pub username: String,
    pub full_name: String,
    pub role_id: String,
    pub role_name: Option<String>,
    pub is_active: bool,
    pub last_login: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub full_name: String,
    pub password: String,
    pub role_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserRequest {
    pub id: String,
    pub full_name: String,
    pub role_id: String,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub description: Option<String>,
    pub permissions: Vec<String>,
}
