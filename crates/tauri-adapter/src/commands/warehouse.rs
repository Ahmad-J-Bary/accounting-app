use crate::bootstrap::container::AppState;
use application::dto::warehouse_dto::{
    CreateWarehouseRequest, UpdateWarehouseRequest, WarehouseDto,
};
use tauri::State;

#[tauri::command]
pub async fn create_warehouse(
    state: State<'_, AppState>,
    request: CreateWarehouseRequest,
) -> Result<WarehouseDto, String> {
    state
        .warehouse_repo
        .create(&request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_warehouses(state: State<'_, AppState>) -> Result<Vec<WarehouseDto>, String> {
    state
        .warehouse_repo
        .list_all()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_warehouse(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<WarehouseDto>, String> {
    let wid = id
        .parse()
        .map_err(|_| "معرّف المستودع غير صالح".to_string())?;
    state
        .warehouse_repo
        .find_by_id(&wid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_warehouse(
    state: State<'_, AppState>,
    request: UpdateWarehouseRequest,
) -> Result<WarehouseDto, String> {
    state
        .warehouse_repo
        .update(&request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_warehouse(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let wid = id
        .parse()
        .map_err(|_| "معرّف المستودع غير صالح".to_string())?;
    state
        .warehouse_repo
        .delete(&wid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_default_warehouse(
    state: State<'_, AppState>,
) -> Result<Option<WarehouseDto>, String> {
    state
        .warehouse_repo
        .get_default()
        .await
        .map_err(|e| e.to_string())
}
