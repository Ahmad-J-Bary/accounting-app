use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::supplier_use_cases::{
    CreateSupplierUseCase, ListSuppliersUseCase, GetSupplierUseCase, UpdateSupplierUseCase, DeleteSupplierUseCase,
};
use application::dto::supplier_dto::{CreateSupplierRequest, UpdateSupplierRequest, SupplierDto};

#[tauri::command]
pub async fn create_supplier(
    request: CreateSupplierRequest,
    state: State<'_, AppState>,
) -> Result<SupplierDto, String> {
    CreateSupplierUseCase::new(state.supplier_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_suppliers(state: State<'_, AppState>) -> Result<Vec<SupplierDto>, String> {
    ListSuppliersUseCase::new(state.supplier_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_supplier(id: String, state: State<'_, AppState>) -> Result<SupplierDto, String> {
    GetSupplierUseCase::new(state.supplier_repo.clone())
        .execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_supplier(
    request: UpdateSupplierRequest,
    state: State<'_, AppState>,
) -> Result<SupplierDto, String> {
    UpdateSupplierUseCase::new(state.supplier_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_supplier(id: String, state: State<'_, AppState>) -> Result<(), String> {
    DeleteSupplierUseCase::new(state.supplier_repo.clone())
        .execute(id).await.map_err(|e| e.to_string())
}
