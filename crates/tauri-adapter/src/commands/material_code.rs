use crate::bootstrap::container::AppState;
use tauri::State;

#[tauri::command]
pub async fn generate_material_code(
    state: State<'_, AppState>,
    category_id: String,
) -> Result<String, String> {
    state.material_code_use_cases.generate_code(category_id).await.map_err(|e| e.to_string())
}
