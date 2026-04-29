use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::adjustment::{
    CreateStockAdjustmentUseCase, StockAdjustmentQueries,
};
use application::dto::adjustment_dto::{CreateStockAdjustmentRequest, StockAdjustmentDto};

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
