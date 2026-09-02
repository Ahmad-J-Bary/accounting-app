use crate::bootstrap::container::AppState;
use application::dto::transfer_dto::{
    CreateTransferRequest, TransferResponse, UpdateTransferRequest,
};
use application::use_cases::transfer::{
    CreateTransferUseCase, DeleteTransferUseCase, UpdateTransferUseCase,
};
use tauri::State;

#[tauri::command]
pub async fn create_transfer(
    state: State<'_, AppState>,
    request: CreateTransferRequest,
) -> Result<TransferResponse, String> {
    let use_case = CreateTransferUseCase::new(
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
        state.warehouse_repo.clone(),
    );
    use_case.execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_transfer(state: State<'_, AppState>, reference: String) -> Result<(), String> {
    let use_case = DeleteTransferUseCase::new(state.stock_movement_repo.clone());
    use_case
        .execute(&reference)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_transfer(
    state: State<'_, AppState>,
    request: UpdateTransferRequest,
) -> Result<TransferResponse, String> {
    let use_case = UpdateTransferUseCase::new(state.stock_movement_repo.clone());
    use_case.execute(request).await.map_err(|e| e.to_string())
}
