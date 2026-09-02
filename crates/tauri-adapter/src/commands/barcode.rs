use tauri::State;

use crate::bootstrap::container::AppState;
use application::dto::barcode_dto::{BarcodeMatchDto, ResolveBarcodeRequest};
use application::use_cases::barcode::ResolveBarcodeUseCase;

#[tauri::command]
pub async fn resolve_barcode(
    state: State<'_, AppState>,
    request: ResolveBarcodeRequest,
) -> Result<BarcodeMatchDto, String> {
    ResolveBarcodeUseCase::new(state.material_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}
