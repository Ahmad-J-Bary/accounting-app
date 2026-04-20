use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::user_use_cases::{
    CreateUserUseCase, ListUsersUseCase, ListRolesUseCase, CreateRoleUseCase,
};
use application::dto::user_dto::{CreateUserRequest, CreateRoleRequest, UserDto, RoleDto};

#[tauri::command]
pub async fn create_user(
    request: CreateUserRequest,
    state: State<'_, AppState>,
) -> Result<UserDto, String> {
    CreateUserUseCase::new(state.user_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_users(state: State<'_, AppState>) -> Result<Vec<UserDto>, String> {
    ListUsersUseCase::new(state.user_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_roles(state: State<'_, AppState>) -> Result<Vec<RoleDto>, String> {
    ListRolesUseCase::new(state.user_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_role(
    request: CreateRoleRequest,
    state: State<'_, AppState>,
) -> Result<RoleDto, String> {
    CreateRoleUseCase::new(state.user_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}
