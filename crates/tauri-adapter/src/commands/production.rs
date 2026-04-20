use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::production_use_cases::{
    CreateProductionOrderUseCase, ListProductionOrdersUseCase, GetProductionOrderUseCase,
};
use application::dto::production_dto::{CreateProductionOrderRequest, ProductionOrderDto};

#[tauri::command]
pub async fn create_production_order(
    request: CreateProductionOrderRequest,
    state: State<'_, AppState>,
) -> Result<ProductionOrderDto, String> {
    CreateProductionOrderUseCase::new(state.production_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_production_orders(
    state: State<'_, AppState>,
) -> Result<Vec<ProductionOrderDto>, String> {
    ListProductionOrdersUseCase::new(state.production_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_production_order(
    id: String,
    state: State<'_, AppState>,
) -> Result<ProductionOrderDto, String> {
    GetProductionOrderUseCase::new(state.production_repo.clone())
        .execute(id).await.map_err(|e| e.to_string())
}
