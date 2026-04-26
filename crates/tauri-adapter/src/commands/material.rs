use crate::bootstrap::container::AppState;
use application::dto::material_dto::{CreateMaterialRequest, UpdateMaterialRequest, MaterialDto};
use tauri::State;

#[tauri::command]
pub async fn create_material(
    state: State<'_, AppState>,
    request: CreateMaterialRequest,
) -> Result<MaterialDto, String> {
    state.material_use_cases.create(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_material(
    state: State<'_, AppState>,
    id: String,
) -> Result<MaterialDto, String> {
    state.material_use_cases.get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_materials(
    state: State<'_, AppState>,
) -> Result<Vec<MaterialDto>, String> {
    state.material_use_cases.list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_material(
    state: State<'_, AppState>,
    request: UpdateMaterialRequest,
) -> Result<MaterialDto, String> {
    state.material_use_cases.update(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_material(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.material_use_cases.delete(id).await.map_err(|e| e.to_string())
}
