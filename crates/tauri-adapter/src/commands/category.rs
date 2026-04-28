use crate::bootstrap::container::AppState;
use application::dto::category_dto::{CreateCategoryRequest, UpdateCategoryRequest, CategoryDto};
use application::use_cases::category::{
    CreateCategoryUseCase, CategoryQueries, UpdateCategoryUseCase, DeleteCategoryUseCase, HybridCategoryUseCase
};
use tauri::State;

#[tauri::command]
pub async fn create_category(
    state: State<'_, AppState>,
    request: CreateCategoryRequest,
) -> Result<CategoryDto, String> {
    CreateCategoryUseCase::new(state.category_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_categories(
    state: State<'_, AppState>,
) -> Result<Vec<CategoryDto>, String> {
    CategoryQueries::new(state.category_repo.clone())
        .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_category(
    state: State<'_, AppState>,
    request: UpdateCategoryRequest,
) -> Result<CategoryDto, String> {
    UpdateCategoryUseCase::new(state.category_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_category(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    DeleteCategoryUseCase::new(state.category_repo.clone())
        .execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_or_create_hybrid_category(
    state: State<'_, AppState>,
    prefixes: Vec<String>,
) -> Result<CategoryDto, String> {
    HybridCategoryUseCase::new(state.category_repo.clone())
        .execute(prefixes).await.map_err(|e| e.to_string())
}
