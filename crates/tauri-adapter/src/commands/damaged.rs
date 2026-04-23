use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::damaged_use_cases::{CreateDamagedItemUseCase, ListDamagedItemsUseCase};
use application::dto::damaged_dto::{CreateDamagedItemRequest, DamagedItemDto};

#[tauri::command]
pub async fn create_damaged_item(
    request: CreateDamagedItemRequest,
    state: State<'_, AppState>,
) -> Result<DamagedItemDto, String> {
    CreateDamagedItemUseCase::new(
        state.damaged_repo.clone(),
        state.product_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
    )
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_damaged_items(
    state: State<'_, AppState>,
) -> Result<Vec<DamagedItemDto>, String> {
    ListDamagedItemsUseCase::new(state.damaged_repo.clone(), state.product_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}
