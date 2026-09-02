use crate::bootstrap::container::AppState;
use application::dto::user_dto::{CreateRoleRequest, CreateUserRequest, RoleDto, UserDto};
use application::use_cases::user::{
    CreateRoleUseCase, CreateUserUseCase, RoleQueries, UserQueries,
};
use tauri::State;

#[tauri::command]
pub async fn create_user(
    request: CreateUserRequest,
    state: State<'_, AppState>,
) -> Result<UserDto, String> {
    CreateUserUseCase::new(state.user_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_users(state: State<'_, AppState>) -> Result<Vec<UserDto>, String> {
    UserQueries::new(state.user_repo.clone())
        .list_all()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_roles(state: State<'_, AppState>) -> Result<Vec<RoleDto>, String> {
    RoleQueries::new(state.user_repo.clone())
        .list_all()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_role(
    request: CreateRoleRequest,
    state: State<'_, AppState>,
) -> Result<RoleDto, String> {
    CreateRoleUseCase::new(state.user_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}
