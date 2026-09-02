use crate::bootstrap::container::AppState;
use application::dto::invoice_dto::{CreateInvoiceRequest, InvoiceDto, UpdateInvoiceRequest};
use application::use_cases::unified_invoice::{
    CreateInvoiceUseCase, DeleteInvoiceUseCase, InvoiceQueries, PostInvoiceDependencies,
    PostInvoiceUseCase, ReopenInvoiceDependencies, ReopenInvoiceUseCase, UpdateInvoiceUseCase,
};
use tauri::State;

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
        state.opening_migration_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_unified_invoice(
    state: State<'_, AppState>,
    request: UpdateInvoiceRequest,
) -> Result<InvoiceDto, String> {
    use domain::sales::unified_invoice::InvoiceStatus;
    use domain::shared::ids::InvoiceId;
    use std::str::FromStr;

    // A Posted unified invoice is auditable financial history. It may not be
    // silently reopened + re-posted; changing it requires the reversal flow.
    // Editing a Posted invoice in place is hard-blocked so stale amounts can
    // never overwrite already-posted partner balances / journals (Sec 10/45).
    let invoice_id =
        InvoiceId::from_str(&request.id).map_err(|_| "معرف فاتورة غير صالح".to_string())?;

    if let Some(existing) = state
        .unified_invoice_repo
        .find_by_id(&invoice_id)
        .await
        .map_err(|e| e.to_string())?
    {
        if existing.status == InvoiceStatus::Posted {
            return Err(
                "لا يمكن تعديل فاتورة مرحّلة. استخدم العكس (Reversal) لإظهار تأثيرها ثم أنشئ فاتورة جديدة".to_string(),
            );
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
        state.opening_migration_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_unified_invoice(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    PostInvoiceUseCase::new(PostInvoiceDependencies {
        repo: state.unified_invoice_repo.clone(),
        movement_repo: state.stock_movement_repo.clone(),
        lot_repo: state.inventory_lot_repo.clone(),
        journal_repo: state.journal_entry_repo.clone(),
        account_repo: state.account_repo.clone(),
        customer_repo: state.customer_repo.clone(),
        supplier_repo: state.supplier_repo.clone(),
        material_repo: state.material_repo.clone(),
        category_repo: state.category_repo.clone(),
        currency_repo: state.currency_repo.clone(),
        exchange_rate_repo: state.exchange_rate_repo.clone(),
        opening_migration_repo: state.opening_migration_repo.clone(),
    })
    .execute(id)
    .await
    .map_err(|e| e.to_string())
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
    )
    .list_by_type(invoice_type)
    .await
    .map_err(|e| e.to_string())
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
    )
    .get_by_id(id)
    .await
    .map_err(|e| e.to_string())
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
    )
    .list_all()
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reopen_unified_invoice(
    state: State<'_, AppState>,
    id: String,
) -> Result<InvoiceDto, String> {
    let reopen_deps = ReopenInvoiceDependencies {
        repo: state.unified_invoice_repo.clone(),
        movement_repo: state.stock_movement_repo.clone(),
        lot_repo: state.inventory_lot_repo.clone(),
        journal_repo: state.journal_entry_repo.clone(),
        customer_repo: state.customer_repo.clone(),
        supplier_repo: state.supplier_repo.clone(),
        currency_repo: state.currency_repo.clone(),
        exchange_rate_repo: state.exchange_rate_repo.clone(),
        payment_repo: state.payment_repo.clone(),
    };
    ReopenInvoiceUseCase::new(reopen_deps)
        .execute(id)
        .await
        .map_err(|e| e.to_string())
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
    )
    .get_next_invoice_number(invoice_type)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_unified_invoice(state: State<'_, AppState>, id: String) -> Result<(), String> {
    DeleteInvoiceUseCase::new(
        state.unified_invoice_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
        state.payment_repo.clone(),
    )
    .execute(id)
    .await
    .map_err(|e| e.to_string())
}
