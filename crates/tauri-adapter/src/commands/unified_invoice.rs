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
    use std::str::FromStr;
    use domain::shared::ids::InvoiceId;
    use domain::sales::unified_invoice::InvoiceStatus;

    // CRITICAL FIX: If the invoice is currently Posted, we MUST reopen it first
    // (while the DB still holds the original amounts) before writing new data.
    //
    // Without this, UpdateInvoiceUseCase writes new amounts while status stays "Posted".
    // Then when postInvoice() is called next, PostInvoiceUseCase calls ReopenInvoiceUseCase
    // which reads the UPDATED (wrong) amounts to reverse, corrupting partner balances.
    //
    // Correct order: reopen (reverse original) → update data → re-post (apply new amounts)
    let invoice_id = InvoiceId::from_str(&request.id)
        .map_err(|_| "معرف فاتورة غير صالح".to_string())?;

    if let Some(existing) = state.unified_invoice_repo
        .find_by_id(&invoice_id)
        .await
        .map_err(|e| e.to_string())?
    {
        if existing.status == InvoiceStatus::Posted {
            application::use_cases::unified_invoice::ReopenInvoiceUseCase::new(
                state.unified_invoice_repo.clone(),
                state.stock_movement_repo.clone(),
                state.journal_entry_repo.clone(),
                state.customer_repo.clone(),
                state.supplier_repo.clone(),
                state.currency_repo.clone(),
                state.exchange_rate_repo.clone(),
            )
            .execute(request.id.clone())
            .await
            .map_err(|e| e.to_string())?;
        }
    }

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
        currency_repo: state.currency_repo.clone(),
        exchange_rate_repo: state.exchange_rate_repo.clone(),
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
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
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
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
    )
    .execute(id).await.map_err(|e| e.to_string())
}
