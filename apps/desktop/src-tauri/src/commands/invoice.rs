use tauri::State;
use crate::bootstrap::container::AppState;
use core_application::use_cases::{CreateInvoiceUseCase, ListInvoicesUseCase, PostInvoiceUseCase};
use core_application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};

#[tauri::command]
pub async fn create_invoice(
    request: CreateInvoiceRequest,
    state: State<'_, AppState>,
) -> Result<InvoiceDto, String> {
    let use_case = CreateInvoiceUseCase::new(state.invoice_repo.clone());
    use_case.execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_invoices(
    customer_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<InvoiceDto>, String> {
    let use_case = ListInvoicesUseCase::new(state.invoice_repo.clone());
    use_case.execute(customer_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_invoice(
    invoice_id: String,
    state: State<'_, AppState>,
) -> Result<InvoiceDto, String> {
    let use_case = PostInvoiceUseCase::new(state.invoice_repo.clone());
    use_case.execute(invoice_id).await.map_err(|e| e.to_string())
}
