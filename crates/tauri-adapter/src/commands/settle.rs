use crate::bootstrap::container::AppState;
use application::use_cases::settle_partner_balance::SettlePartnerBalanceUseCase;
use tauri::State;

#[tauri::command]
pub async fn settle_partner_balance(
    state: State<'_, AppState>,
    partner_type: String,
    partner_id: String,
) -> Result<String, String> {
    let use_case = SettlePartnerBalanceUseCase::new(
        state.payment_repo.clone(),
        state.journal_entry_repo.clone(),
        state.account_repo.clone(),
        state.customer_repo.clone(),
        state.supplier_repo.clone(),
        state.currency_repo.clone(),
    );
    use_case
        .execute(partner_type, partner_id)
        .await
        .map_err(|e| e.to_string())
}
