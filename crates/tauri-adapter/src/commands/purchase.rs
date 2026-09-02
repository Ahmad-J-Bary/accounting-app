use crate::bootstrap::container::AppState;
use application::dto::purchase_invoice_dto::{CreatePurchaseInvoiceRequest, PurchaseInvoiceDto};
use application::use_cases::purchase_invoice::{
    CreatePurchaseInvoiceUseCase, GetPurchaseInvoiceUseCase, ListPurchaseInvoicesUseCase,
    PostPurchaseInvoiceUseCase,
};
use tauri::State;

#[tauri::command]
pub async fn create_purchase_invoice(
    request: CreatePurchaseInvoiceRequest,
    state: State<'_, AppState>,
) -> Result<PurchaseInvoiceDto, String> {
    CreatePurchaseInvoiceUseCase::new(
        state.purchase_invoice_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.account_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_purchase_invoices(
    supplier_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<PurchaseInvoiceDto>, String> {
    ListPurchaseInvoicesUseCase::new(
        state.purchase_invoice_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.account_repo.clone(),
    )
    .execute(supplier_id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_purchase_invoice(
    id: String,
    state: State<'_, AppState>,
) -> Result<PurchaseInvoiceDto, String> {
    GetPurchaseInvoiceUseCase::new(
        state.purchase_invoice_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.account_repo.clone(),
    )
    .execute(&id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_purchase_invoice(
    id: String,
    state: State<'_, AppState>,
) -> Result<PurchaseInvoiceDto, String> {
    PostPurchaseInvoiceUseCase::new(
        state.purchase_invoice_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
    )
    .execute(id)
    .await
    .map_err(|e| e.to_string())
}
