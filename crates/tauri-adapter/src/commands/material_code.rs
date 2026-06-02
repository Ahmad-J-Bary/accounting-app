use crate::bootstrap::container::AppState;
use tauri::State;
use application::errors::AppError;

#[tauri::command]
pub async fn generate_material_code(
    state: State<'_, AppState>,
    category_id: String,
) -> Result<String, String> {
    let res: Result<String, AppError> = state.material_code_use_cases.generate_code(category_id).await;
    res.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn preview_material_code(
    state: State<'_, AppState>,
    category_id: String,
) -> Result<String, String> {
    let res: Result<String, AppError> = state.material_code_use_cases.preview_code(category_id).await;
    res.map_err(|e| e.to_string())
}
