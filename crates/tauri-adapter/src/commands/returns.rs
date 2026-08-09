use tauri::State;
use std::str::FromStr;
use rust_decimal::Decimal;
use crate::bootstrap::container::AppState;
use application::dto::returns_dto::*;
use application::use_cases::sales_return::{
    CreateSalesReturnUseCase, SalesReturnQueries, PostSalesReturnUseCase,
};
use application::use_cases::purchase_return::{
    CreatePurchaseReturnUseCase, PurchaseReturnQueries, PostPurchaseReturnUseCase,
};
use domain::shared::ids::{SalesReturnId, PurchaseReturnId};

fn return_reference(return_id: &str) -> String {
    format!("return:{}", return_id)
}

async fn delete_payment_by_reference(state: &AppState, reference: &str) -> Result<(), String> {
    let all = state.payment_repo.list_all().await.map_err(|e| e.to_string())?;
    for payment in all {
        if payment.reference.as_deref() == Some(reference) {
            // Delete cash journal entry referenced by the payment
            if let Some(ref entry_number) = payment.journal_entry_number {
                if let Some(entry) = state.journal_entry_repo.find_by_number(entry_number)
                    .await.map_err(|e| format!("فشل البحث عن قيد اليومية: {}", e))?
                {
                    state.journal_entry_repo.delete(&entry.id).await
                        .map_err(|e| format!("فشل حذف قيد اليومية: {}", e))?;
                }
            }
            // Also delete any entry by source_id (legacy)
            let pid_str = payment.id.to_string();
            if let Some(entry) = state.journal_entry_repo.find_by_source_id(&pid_str)
                .await.map_err(|e| format!("فشل البحث عن قيد اليومية: {}", e))?
            {
                state.journal_entry_repo.delete(&entry.id).await
                    .map_err(|e| format!("فشل حذف قيد اليومية: {}", e))?;
            }
            state.payment_repo.delete(&payment.id).await.map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

async fn reverse_sales_return_impact(
    state: &AppState,
    existing: &domain::returns::SalesReturn,
) -> Result<(), String> {
    // 1. Find return journal entries and extract partner line BEFORE deleting
    let entries = state.journal_entry_repo.find_all_by_source_id(&existing.id.0.to_string()).await
        .map_err(|e| format!("فشل البحث عن قيود اليومية: {}", e))?;

    // Extract total credited to customer from the return entry's partner line
    let partner_uuid = existing.customer_id.0;
    let partner_settlement = entries.first()
        .and_then(|entry| entry.lines.iter()
            .find(|line| line.partner_id == Some(partner_uuid)))
        .map(|line| line.credit.base_amount)
        .unwrap_or(Decimal::ZERO);

    // 2. Find payment record and get cash_amount BEFORE deleting
    let payment_ref = return_reference(&existing.id.0.to_string());
    let cash_amount = {
        let all = state.payment_repo.list_all().await.map_err(|e| e.to_string())?;
        all.iter()
            .find(|p| p.reference.as_deref() == Some(&payment_ref))
            .map(|p| p.amount)
            .unwrap_or(Decimal::ZERO)
    };

    // 3. Delete stock movements by reference (SalesReturn type only)
    state.stock_movement_repo.delete_by_reference(&existing.return_number, "SalesReturn").await
        .map_err(|e| format!("فشل حذف حركات المخزون: {}", e))?;

    // 4. Delete return journal entries
    for entry in &entries {
        state.journal_entry_repo.delete(&entry.id).await
            .map_err(|e| format!("فشل حذف قيد اليومية: {}", e))?;
    }

    // 5. Reverse partner balance:
    //    Return entry: decrease_debit(total) → reverse: increase_debit(partner_settlement)
    //    Cash entry:   increase_debit(cash)   → reverse: decrease_debit(cash)
    if partner_settlement > Decimal::ZERO || cash_amount > Decimal::ZERO {
        if let Some(customer) = state.customer_repo.find_by_id(&existing.customer_id).await
            .map_err(|e| format!("فشل العثور على العميل: {}", e))?
        {
            if let Some(base_currency) = state.currency_repo.get_base_currency().await
                .map_err(|e| format!("فشل العثور على العملة الأساسية: {}", e))?
            {
                let mut updated_customer = customer;

                if partner_settlement > Decimal::ZERO {
                    let converted = application::use_cases::unified_invoice::post::convert_to_partner_currency(
                        partner_settlement,
                        &base_currency.code,
                        rust_decimal::Decimal::ONE,
                        &updated_customer.currency.code,
                        &state.currency_repo,
                        &state.exchange_rate_repo,
                    ).await.map_err(|e| format!("فشل تحويل العملة: {}", e))?;
                    updated_customer.increase_debit(converted)
                        .map_err(|e| format!("فشل تحديث رصيد العميل: {}", e))?;
                }

                if cash_amount > Decimal::ZERO {
                    let converted = application::use_cases::unified_invoice::post::convert_to_partner_currency(
                        cash_amount,
                        &base_currency.code,
                        rust_decimal::Decimal::ONE,
                        &updated_customer.currency.code,
                        &state.currency_repo,
                        &state.exchange_rate_repo,
                    ).await.map_err(|e| format!("فشل تحويل العملة: {}", e))?;
                    updated_customer.decrease_debit(converted)
                        .map_err(|e| format!("فشل تحديث رصيد العميل: {}", e))?;
                }

                state.customer_repo.update(&updated_customer).await
                    .map_err(|e| format!("فشل حفظ العميل: {}", e))?;
            }
        }
    }

    // 6. Delete payment voucher (also deletes the cash journal entry)
    let _ = delete_payment_by_reference(state, &return_reference(&existing.id.0.to_string())).await;
    Ok(())
}

async fn reverse_purchase_return_impact(
    state: &AppState,
    existing: &domain::returns::PurchaseReturn,
) -> Result<(), String> {
    // 1. Find return journal entries and extract partner line BEFORE deleting
    let entries = state.journal_entry_repo.find_all_by_source_id(&existing.id.0.to_string()).await
        .map_err(|e| format!("فشل البحث عن قيود اليومية: {}", e))?;

    // Extract total debited to supplier from the return entry's partner line
    let partner_uuid = existing.supplier_id.0;
    let partner_settlement = entries.first()
        .and_then(|entry| entry.lines.iter()
            .find(|line| line.partner_id == Some(partner_uuid)))
        .map(|line| line.debit.base_amount)
        .unwrap_or(Decimal::ZERO);

    // 2. Find payment record and get cash_amount BEFORE deleting
    let payment_ref = return_reference(&existing.id.0.to_string());
    let cash_amount = {
        let all = state.payment_repo.list_all().await.map_err(|e| e.to_string())?;
        all.iter()
            .find(|p| p.reference.as_deref() == Some(&payment_ref))
            .map(|p| p.amount)
            .unwrap_or(Decimal::ZERO)
    };

    // 3. Delete stock movements by reference (PurchaseReturn type only)
    state.stock_movement_repo.delete_by_reference(&existing.return_number, "PurchaseReturn").await
        .map_err(|e| format!("فشل حذف حركات المخزون: {}", e))?;

    // 4. Delete return journal entries
    for entry in &entries {
        state.journal_entry_repo.delete(&entry.id).await
            .map_err(|e| format!("فشل حذف قيد اليومية: {}", e))?;
    }

    // 5. Reverse partner balance:
    //    Return entry: decrease_credit(total) → reverse: increase_credit(partner_settlement)
    //    Cash entry:   increase_credit(cash)   → reverse: decrease_credit(cash)
    if partner_settlement > Decimal::ZERO || cash_amount > Decimal::ZERO {
        if let Some(supplier) = state.supplier_repo.find_by_id(&existing.supplier_id).await
            .map_err(|e| format!("فشل العثور على المورد: {}", e))?
        {
            if let Some(base_currency) = state.currency_repo.get_base_currency().await
                .map_err(|e| format!("فشل العثور على العملة الأساسية: {}", e))?
            {
                let mut updated_supplier = supplier;

                if partner_settlement > Decimal::ZERO {
                    let converted = application::use_cases::unified_invoice::post::convert_to_partner_currency(
                        partner_settlement,
                        &base_currency.code,
                        rust_decimal::Decimal::ONE,
                        &updated_supplier.currency.code,
                        &state.currency_repo,
                        &state.exchange_rate_repo,
                    ).await.map_err(|e| format!("فشل تحويل العملة: {}", e))?;
                    updated_supplier.increase_credit(converted)
                        .map_err(|e| format!("فشل تحديث رصيد المورد: {}", e))?;
                }

                if cash_amount > Decimal::ZERO {
                    let converted = application::use_cases::unified_invoice::post::convert_to_partner_currency(
                        cash_amount,
                        &base_currency.code,
                        rust_decimal::Decimal::ONE,
                        &updated_supplier.currency.code,
                        &state.currency_repo,
                        &state.exchange_rate_repo,
                    ).await.map_err(|e| format!("فشل تحويل العملة: {}", e))?;
                    updated_supplier.decrease_credit(converted)
                        .map_err(|e| format!("فشل تحديث رصيد المورد: {}", e))?;
                }

                state.supplier_repo.update(&updated_supplier).await
                    .map_err(|e| format!("فشل حفظ المورد: {}", e))?;
            }
        }
    }

    // 6. Delete payment voucher (also deletes the cash journal entry)
    let _ = delete_payment_by_reference(state, &return_reference(&existing.id.0.to_string())).await;
    Ok(())
}

#[tauri::command]
pub async fn delete_sales_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let rid = SalesReturnId::from_str(&id)
        .map_err(|_| "معرف المرتجع غير صالح".to_string())?;

    if let Some(existing) = state.sales_return_repo.find_by_id(&rid).await.map_err(|e| e.to_string())? {
        reverse_sales_return_impact(&state, &existing).await?;
    }

    state.sales_return_repo.delete(&rid).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_purchase_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let rid = PurchaseReturnId::from_str(&id)
        .map_err(|_| "معرف المرتجع غير صالح".to_string())?;

    if let Some(existing) = state.purchase_return_repo.find_by_id(&rid).await.map_err(|e| e.to_string())? {
        reverse_purchase_return_impact(&state, &existing).await?;
    }

    state.purchase_return_repo.delete(&rid).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_sales_return(
    state: State<'_, AppState>,
    request: CreateSalesReturnRequest,
) -> Result<SalesReturnDto, String> {
    if let Some(ref edit_id) = request.id {
        let rid = SalesReturnId::from_str(edit_id)
            .map_err(|_| "معرف المرتجع غير صالح".to_string())?;
        if let Some(existing) = state.sales_return_repo.find_by_id(&rid).await.map_err(|e| e.to_string())? {
            reverse_sales_return_impact(&state, &existing).await?;
        }
    }

    let settlement_mode = request.settlement_mode.clone();
    let settlement_amount = request.settlement_amount.clone();
    let is_paid = request.is_paid;

    let dto = CreateSalesReturnUseCase::new(
        state.sales_return_repo.clone(),
        state.customer_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())?;

    let post_use_case = PostSalesReturnUseCase::new(
        state.sales_return_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
    );
    post_use_case.execute(dto.id.clone(), settlement_mode, settlement_amount, is_paid).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_sales_returns(
    state: State<'_, AppState>,
) -> Result<Vec<SalesReturnDto>, String> {
    SalesReturnQueries::new(
        state.sales_return_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
    )
    .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sales_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<SalesReturnDto, String> {
    SalesReturnQueries::new(
        state.sales_return_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
    )
    .get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_sales_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<SalesReturnDto, String> {
    PostSalesReturnUseCase::new(
        state.sales_return_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
        state.customer_repo.clone(),
        state.material_repo.clone(),
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
    )
    .execute(id, None, None, None).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_purchase_return(
    state: State<'_, AppState>,
    request: CreatePurchaseReturnRequest,
) -> Result<PurchaseReturnDto, String> {
    if let Some(ref edit_id) = request.id {
        let rid = PurchaseReturnId::from_str(edit_id)
            .map_err(|_| "معرف المرتجع غير صالح".to_string())?;
        if let Some(existing) = state.purchase_return_repo.find_by_id(&rid).await.map_err(|e| e.to_string())? {
            reverse_purchase_return_impact(&state, &existing).await?;
        }
    }

    let settlement_mode = request.settlement_mode.clone();
    let settlement_amount = request.settlement_amount.clone();
    let is_paid = request.is_paid;

    let dto = CreatePurchaseReturnUseCase::new(
        state.purchase_return_repo.clone(),
        state.supplier_repo.clone(),
    )
    .execute(request).await.map_err(|e| e.to_string())?;

    let post_use_case = PostPurchaseReturnUseCase::new(
        state.purchase_return_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
    );
    post_use_case.execute(dto.id.clone(), settlement_mode, settlement_amount, is_paid).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_purchase_returns(
    state: State<'_, AppState>,
) -> Result<Vec<PurchaseReturnDto>, String> {
    PurchaseReturnQueries::new(
        state.purchase_return_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
    )
    .list_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_purchase_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<PurchaseReturnDto, String> {
    PurchaseReturnQueries::new(
        state.purchase_return_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
    )
    .get_by_id(id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_purchase_return(
    state: State<'_, AppState>,
    id: String,
) -> Result<PurchaseReturnDto, String> {
    PostPurchaseReturnUseCase::new(
        state.purchase_return_repo.clone(),
        state.stock_movement_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
        state.supplier_repo.clone(),
        state.material_repo.clone(),
        state.currency_repo.clone(),
        state.exchange_rate_repo.clone(),
    )
    .execute(id, None, None, None).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_next_sales_return_number(state: State<'_, AppState>) -> Result<String, String> {
    state.sales_return_repo.get_next_return_number().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_next_purchase_return_number(state: State<'_, AppState>) -> Result<String, String> {
    state.purchase_return_repo.get_next_return_number().await.map_err(|e| e.to_string())
}
