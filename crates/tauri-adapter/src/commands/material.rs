use crate::bootstrap::container::AppState;
use application::dto::material_dto::{CreateMaterialRequest, UpdateMaterialRequest, MaterialDto};
use application::use_cases::material::{
    CreateMaterialUseCase, MaterialQueries, UpdateMaterialUseCase, DeleteMaterialUseCase
};
use tauri::State;

fn make_queries(state: &AppState) -> MaterialQueries {
    MaterialQueries::new(
        state.material_repo.clone(), 
        state.stock_movement_repo.clone(),
        state.unified_invoice_repo.clone(),
    )
    .with_lot_repo(state.inventory_lot_repo.clone())
}

#[tauri::command]
pub async fn create_material(
    state: State<'_, AppState>,
    request: CreateMaterialRequest,
) -> Result<MaterialDto, String> {
    CreateMaterialUseCase::new(state.material_repo.clone(), state.category_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_material(
    state: State<'_, AppState>,
    id: String,
) -> Result<MaterialDto, String> {
    make_queries(&state)
        .get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_materials(
    state: State<'_, AppState>,
) -> Result<Vec<MaterialDto>, String> {
    make_queries(&state)
        .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_material(
    state: State<'_, AppState>,
    request: UpdateMaterialRequest,
) -> Result<MaterialDto, String> {
    UpdateMaterialUseCase::new(state.material_repo.clone(), state.stock_movement_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_material(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    DeleteMaterialUseCase::new(state.material_repo.clone(), state.stock_movement_repo.clone())
        .execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_material_costing_method(
    state: State<'_, AppState>,
    material_id: String,
    costing_method: String,
) -> Result<(), String> {
    state.inventory_lot_repo
        .update_costing_method(&material_id, &costing_method)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_material_unit(
    state: State<'_, AppState>,
    request: application::dto::material_dto::AddMaterialUnitRequest,
) -> Result<(), String> {
    let mid = request.material_id.parse().map_err(|_| "معرف مادة غير صالح".to_string())?;
    let factor = request.conversion_factor.parse().map_err(|_| "معامل التحويل غير صالح".to_string())?;
    
    state.material_repo.add_unit(&mid, request.name, factor, request.barcode)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_material_unit(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state.material_repo.delete_unit(&id)
        .await.map_err(|e| e.to_string())
}
