use crate::bootstrap::container::AppState;
use application::dto::customer_dto::{CreateCustomerRequest, UpdateCustomerRequest, CustomerDto};
use application::use_cases::customer_use_cases::{
    CreateCustomerUseCase, UpdateCustomerUseCase, ListCustomersUseCase, GetCustomerUseCase, DeleteCustomerUseCase
};
use tauri::State;

#[tauri::command]
pub async fn create_customer(
    state: State<'_, AppState>,
    request: CreateCustomerRequest,
) -> Result<CustomerDto, String> {
    let use_case = CreateCustomerUseCase::new(state.customer_repo.clone());
    use_case.execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_customer(
    state: State<'_, AppState>,
    id: String,
) -> Result<CustomerDto, String> {
    let use_case = GetCustomerUseCase::new(state.customer_repo.clone());
    use_case.execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_customers(
    state: State<'_, AppState>,
) -> Result<Vec<CustomerDto>, String> {
    let use_case = ListCustomersUseCase::new(state.customer_repo.clone());
    use_case.execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_customer(
    state: State<'_, AppState>,
    request: UpdateCustomerRequest,
) -> Result<CustomerDto, String> {
    let use_case = UpdateCustomerUseCase::new(state.customer_repo.clone());
    use_case.execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_customer(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let use_case = DeleteCustomerUseCase::new(state.customer_repo.clone());
    use_case.execute(id).await.map_err(|e| e.to_string())
}
