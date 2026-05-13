use tauri::State;
use crate::bootstrap::container::AppState;
use application::dto::invoice_dto::{CreateInvoiceRequest, UpdateInvoiceRequest, InvoiceDto};
use application::use_cases::unified_invoice::{
    CreateInvoiceUseCase, UpdateInvoiceUseCase, InvoiceQueries, PostInvoiceUseCase, PostInvoiceDependencies, DeleteInvoiceUseCase
};

#[tauri::command]
pub async fn create_unified_invoice(
    state: State<'_, AppState>,
    request: CreateInvoiceRequest,
) -> Result<InvoiceDto, String> {
    CreateInvoiceUseCase::new(
        state.unified_invoice_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.account_repo.clone(),
        state.material_repo.clone(),
        state.category_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_unified_invoice(
    state: State<'_, AppState>,
    request: UpdateInvoiceRequest,
) -> Result<InvoiceDto, String> {
    UpdateInvoiceUseCase::new(
        state.unified_invoice_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.account_repo.clone(),
        state.material_repo.clone(),
        state.category_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_unified_invoice(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    PostInvoiceUseCase::new(PostInvoiceDependencies {
        repo: state.unified_invoice_repo.clone(), 
        movement_repo: state.stock_movement_repo.clone(),
        journal_repo: state.journal_entry_repo.clone(),
        account_repo: state.account_repo.clone(),
        customer_repo: state.customer_repo.clone(),
        supplier_repo: state.supplier_repo.clone(),
        material_repo: state.material_repo.clone(),
        category_repo: state.category_repo.clone(),
    })
    .execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_unified_invoices_by_type(
    state: State<'_, AppState>,
    invoice_type: String,
) -> Result<Vec<InvoiceDto>, String> {
    InvoiceQueries::new(
        state.unified_invoice_repo.clone(),
        state.material_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.category_repo.clone(),
    ).list_by_type(invoice_type).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_unified_invoice_by_id(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    InvoiceQueries::new(
        state.unified_invoice_repo.clone(),
        state.material_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.category_repo.clone(),
    ).get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_all_unified_invoices(
    state: State<'_, AppState>,
) -> Result<Vec<InvoiceDto>, String> {
    InvoiceQueries::new(
        state.unified_invoice_repo.clone(),
        state.material_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.category_repo.clone(),
    ).list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reopen_unified_invoice(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    application::use_cases::unified_invoice::ReopenInvoiceUseCase::new(
        state.unified_invoice_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
    )
    .execute(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_next_invoice_number(
    invoice_type: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    InvoiceQueries::new(
        state.unified_invoice_repo.clone(),
        state.material_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.category_repo.clone(),
    ).get_next_invoice_number(invoice_type).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_unified_invoice(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    DeleteInvoiceUseCase::new(
        state.unified_invoice_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
    )
    .execute(id).await.map_err(|e| e.to_string())
}
