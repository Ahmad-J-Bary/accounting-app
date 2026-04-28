use crate::bootstrap::container::AppState;
use application::dto::category_dto::{CreateCategoryRequest, UpdateCategoryRequest, CategoryDto};
use tauri::State;

#[tauri::command]
pub async fn create_category(
    state: State<'_, AppState>,
    request: CreateCategoryRequest,
) -> Result<CategoryDto, String> {
    state.category_use_cases.create(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_categories(
    state: State<'_, AppState>,
) -> Result<Vec<CategoryDto>, String> {
    state.category_use_cases.list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_category(
    state: State<'_, AppState>,
    request: UpdateCategoryRequest,
) -> Result<CategoryDto, String> {
    state.category_use_cases.update(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_category(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.category_use_cases.delete(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_or_create_hybrid_category(
    state: State<'_, AppState>,
    prefixes: Vec<String>,
) -> Result<CategoryDto, String> {
    state.category_use_cases.get_or_create_hybrid(prefixes).await.map_err(|e| e.to_string())
}
