use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::payment::{CreatePaymentUseCase, ListPaymentsUseCase, DeletePaymentUseCase};
use application::dto::payment_dto::{CreatePaymentRequest, PaymentDto};

#[tauri::command]
pub async fn create_payment(
    request: CreatePaymentRequest,
    state: State<'_, AppState>,
) -> Result<PaymentDto, String> {
    CreatePaymentUseCase::new(
        state.payment_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_payments(
    customer_id: Option<String>,
    supplier_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<PaymentDto>, String> {
    ListPaymentsUseCase::new(
        state.payment_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
    )
    .execute(customer_id, supplier_id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_payment(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    DeletePaymentUseCase::new(state.payment_repo.clone(), state.journal_entry_repo.clone())
        .execute(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_payment(
    request: application::dto::payment_dto::UpdatePaymentRequest,
    state: State<'_, AppState>,
) -> Result<PaymentDto, String> {
    application::use_cases::payment::UpdatePaymentUseCase::new(
        state.payment_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}
