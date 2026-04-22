use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::get_chart_of_accounts::GetChartOfAccountsUseCase;
use application::use_cases::get_account_ledger::GetAccountLedgerUseCase;
use application::dto::account_dto::{AccountDto, AccountLedgerDto};

#[tauri::command]
pub async fn get_chart_of_accounts(
    state: State<'_, AppState>,
) -> Result<Vec<AccountDto>, String> {
    GetChartOfAccountsUseCase::new(state.account_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_account_ledger(
    account_id: String,
    state: State<'_, AppState>,
) -> Result<AccountLedgerDto, String> {
    GetAccountLedgerUseCase::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .execute(account_id).await.map_err(|e| e.to_string())
}
