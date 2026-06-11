use crate::bootstrap::container::AppState;
use application::dto::transfer_dto::{CreateTransferRequest, TransferResponse};
use application::use_cases::transfer::CreateTransferUseCase;
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
