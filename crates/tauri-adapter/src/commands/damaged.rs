use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::damaged::{
    CreateDamagedItemUseCase,
    DamagedItemQueries,
    UpdateDamagedItemUseCase,
    DeleteDamagedItemUseCase,
};
use application::dto::damaged_dto::{CreateDamagedItemRequest, DamagedItemDto, UpdateDamagedItemRequest};

#[tauri::command]
pub async fn create_damaged_item(
    request: CreateDamagedItemRequest,
    state: State<'_, AppState>,
) -> Result<DamagedItemDto, String> {
    CreateDamagedItemUseCase::new(
        state.damaged_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
    )
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_damaged_items(
    state: State<'_, AppState>,
) -> Result<Vec<DamagedItemDto>, String> {
    DamagedItemQueries::new(state.damaged_repo.clone(), state.material_repo.clone())
        .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_damaged_item(
    request: UpdateDamagedItemRequest,
    state: State<'_, AppState>,
) -> Result<DamagedItemDto, String> {
    UpdateDamagedItemUseCase::new(
        state.damaged_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
    )
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_damaged_item(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    DeleteDamagedItemUseCase::new(
        state.damaged_repo.clone(),
        state.stock_movement_repo.clone(),
    )
        .execute(&id).await.map_err(|e| e.to_string())
}
