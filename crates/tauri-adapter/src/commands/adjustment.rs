use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::adjustment::{
    CreateStockAdjustmentUseCase, StockAdjustmentQueries,
    UpdateStockAdjustmentUseCase, DeleteStockAdjustmentUseCase,
};
use application::dto::adjustment_dto::{CreateStockAdjustmentRequest, UpdateStockAdjustmentRequest, StockAdjustmentDto};

#[tauri::command]
pub async fn create_stock_adjustment(
    request: CreateStockAdjustmentRequest,
    state: State<'_, AppState>,
) -> Result<StockAdjustmentDto, String> {
    CreateStockAdjustmentUseCase::new(
        state.adjustment_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_stock_adjustments(
    state: State<'_, AppState>,
) -> Result<Vec<StockAdjustmentDto>, String> {
    StockAdjustmentQueries::new(state.adjustment_repo.clone(), state.material_repo.clone())
        .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_stock_adjustment(
    id: String,
    state: State<'_, AppState>,
) -> Result<StockAdjustmentDto, String> {
    StockAdjustmentQueries::new(state.adjustment_repo.clone(), state.material_repo.clone())
        .find_by_id(&id).await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "التسوية غير موجودة".to_string())
}

#[tauri::command]
pub async fn update_stock_adjustment(
    request: UpdateStockAdjustmentRequest,
    state: State<'_, AppState>,
) -> Result<StockAdjustmentDto, String> {
    UpdateStockAdjustmentUseCase::new(
        state.adjustment_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_stock_adjustment(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    DeleteStockAdjustmentUseCase::new(
        state.adjustment_repo.clone(),
        state.stock_movement_repo.clone(),
    )
    .execute(&id).await.map_err(|e| e.to_string())
}
