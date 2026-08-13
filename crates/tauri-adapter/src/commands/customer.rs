use crate::bootstrap::container::AppState;
use application::dto::customer_dto::{CreateCustomerRequest, UpdateCustomerRequest, CustomerDto};
use application::use_cases::customer::{
    CreateCustomerUseCase, UpdateCustomerUseCase, DeleteCustomerUseCase, CustomerQueries
};
use tauri::State;

#[tauri::command]
pub async fn create_customer(
    state: State<'_, AppState>,
    request: CreateCustomerRequest,
) -> Result<CustomerDto, String> {
    CreateCustomerUseCase::new(
        state.customer_repo.clone(), 
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
        state.opening_migration_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_customer(
    state: State<'_, AppState>,
    id: String,
) -> Result<CustomerDto, String> {
    CustomerQueries::new(state.customer_repo.clone())
        .get_by_id(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_customers(
    state: State<'_, AppState>,
) -> Result<Vec<CustomerDto>, String> {
    CustomerQueries::new(state.customer_repo.clone())
        .list_all()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_customer(
    state: State<'_, AppState>,
    request: UpdateCustomerRequest,
) -> Result<CustomerDto, String> {
    UpdateCustomerUseCase::new(
        state.customer_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    )
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_customer(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    DeleteCustomerUseCase::new(
        state.customer_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(id)
    .await
    .map_err(|e| e.to_string())
}
