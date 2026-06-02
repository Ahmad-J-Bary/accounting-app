use tauri::State;
use std::str::FromStr;
use crate::bootstrap::container::AppState;
use application::dto::returns_dto::*;
use application::use_cases::sales_return::{
    CreateSalesReturnUseCase, SalesReturnQueries, PostSalesReturnUseCase,
};
use application::use_cases::purchase_return::{
    CreatePurchaseReturnUseCase, PurchaseReturnQueries, PostPurchaseReturnUseCase,
};
use domain::shared::ids::{SalesReturnId, PurchaseReturnId};

#[tauri::command]
pub async fn delete_sales_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let rid = SalesReturnId::from_str(&id)
        .map_err(|_| "معرف المرتجع غير صالح".to_string())?;
    state.sales_return_repo.delete(&rid).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_purchase_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let rid = PurchaseReturnId::from_str(&id)
        .map_err(|_| "معرف المرتجع غير صالح".to_string())?;
    state.purchase_return_repo.delete(&rid).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_sales_return(
    state: State<'_, AppState>,
    request: CreateSalesReturnRequest,
) -> Result<SalesReturnDto, String> {
    CreateSalesReturnUseCase::new(
        state.sales_return_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_sales_returns(
    state: State<'_, AppState>,
) -> Result<Vec<SalesReturnDto>, String> {
    SalesReturnQueries::new(
        state.sales_return_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
    )
    .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sales_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<SalesReturnDto, String> {
    SalesReturnQueries::new(
        state.sales_return_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
    )
    .get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_sales_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<SalesReturnDto, String> {
    PostSalesReturnUseCase::new(
        state.sales_return_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
    )
    .execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_purchase_return(
    state: State<'_, AppState>,
    request: CreatePurchaseReturnRequest,
) -> Result<PurchaseReturnDto, String> {
    CreatePurchaseReturnUseCase::new(
        state.purchase_return_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_purchase_returns(
    state: State<'_, AppState>,
) -> Result<Vec<PurchaseReturnDto>, String> {
    PurchaseReturnQueries::new(
        state.purchase_return_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
    )
    .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_purchase_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<PurchaseReturnDto, String> {
    PurchaseReturnQueries::new(
        state.purchase_return_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
    )
    .get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_purchase_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<PurchaseReturnDto, String> {
    PostPurchaseReturnUseCase::new(
        state.purchase_return_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
    )
    .execute(id).await.map_err(|e| e.to_string())
}
