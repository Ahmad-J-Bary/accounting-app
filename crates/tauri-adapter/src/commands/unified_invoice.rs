use tauri::State;
use crate::bootstrap::container::AppState;
use application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto};

#[tauri::command]
pub async fn create_unified_invoice(
    state: State<'_, AppState>,
    request: CreateInvoiceRequest,
) -> Result<InvoiceDto, String> {
    state.unified_invoice_use_cases.create(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_unified_invoice(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    state.unified_invoice_use_cases.post(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_unified_invoices_by_type(
    state: State<'_, AppState>,
    invoice_type: String,
) -> Result<Vec<InvoiceDto>, String> {
    state.unified_invoice_use_cases.list_by_type(invoice_type).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_unified_invoice_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    state.unified_invoice_use_cases.get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_unified_invoices(
    state: State<'_, AppState>,
) -> Result<Vec<InvoiceDto>, String> {
    state.unified_invoice_use_cases.list_all().await.map_err(|e| e.to_string())
}
