use tauri::State;
use crate::bootstrap::container::AppState;
use application::{CreateInvoiceUseCase, ListInvoicesUseCase, PostInvoiceUseCase};
use application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};
use application::errors::AppError;

#[tauri::command]
pub async fn create_invoice(
    request: CreateInvoiceRequest,
    state: State<'_, AppState>,
) -> Result<InvoiceDto, String> {
    let use_case = CreateInvoiceUseCase::new(
        state.invoice_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
    );
    let result: Result<InvoiceDto, AppError> = use_case.execute(request).await;
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_invoices(
    customer_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<InvoiceDto>, String> {
    let use_case = ListInvoicesUseCase::new(
        state.invoice_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
    );
    let result: Result<Vec<InvoiceDto>, AppError> = use_case.execute(customer_id).await;
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_invoice(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    let use_case = PostInvoiceUseCase::new(
        state.invoice_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
    );
    use_case.execute(id).await.map_err(|e| e.to_string())
}
