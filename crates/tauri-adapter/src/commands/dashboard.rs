use crate::bootstrap::container::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct ReceivablesPayablesSummary {
    pub total_receivables: String,
    pub total_payables: String,
    pub net_position: String,
    pub customers_debit: String,
    pub customers_credit: String,
    pub suppliers_debit: String,
    pub suppliers_credit: String,
    pub unlinked_customers: i32,
    pub unlinked_suppliers: i32,
}

#[tauri::command]
pub async fn get_receivables_payables_summary(
    state: State<'_, AppState>,
) -> Result<ReceivablesPayablesSummary, String> {
    let customers = state
        .customer_repo
        .list_all()
        .await
        .map_err(|e| e.to_string())?;
    let suppliers = state
        .supplier_repo
        .list_all()
        .await
        .map_err(|e| e.to_string())?;

    let total_receivables: rust_decimal::Decimal = customers
        .iter()
        .filter(|c| c.is_debtor())
        .map(|c| c.effective_balance())
        .sum();

    let total_payables: rust_decimal::Decimal = suppliers
        .iter()
        .filter(|s| s.is_payable())
        .map(|s| s.effective_balance())
        .sum();

    let customers_debit: rust_decimal::Decimal = customers.iter().map(|c| c.debit).sum();
    let customers_credit: rust_decimal::Decimal = customers.iter().map(|c| c.credit).sum();
    let suppliers_debit: rust_decimal::Decimal = suppliers.iter().map(|s| s.debit).sum();
    let suppliers_credit: rust_decimal::Decimal = suppliers.iter().map(|s| s.credit).sum();

    let unlinked_customers = customers.iter().filter(|c| c.account_id.is_none()).count() as i32;
    let unlinked_suppliers = suppliers.iter().filter(|s| s.account_id.is_none()).count() as i32;

    let net_position = total_receivables - total_payables;

    Ok(ReceivablesPayablesSummary {
        total_receivables: total_receivables.to_string(),
        total_payables: total_payables.to_string(),
        net_position: net_position.to_string(),
        customers_debit: customers_debit.to_string(),
        customers_credit: customers_credit.to_string(),
        suppliers_debit: suppliers_debit.to_string(),
        suppliers_credit: suppliers_credit.to_string(),
        unlinked_customers,
        unlinked_suppliers,
    })
}
