use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::get_chart_of_accounts::GetChartOfAccountsUseCase;
use application::use_cases::get_account_ledger::GetAccountLedgerUseCase;
use application::use_cases::account_use_cases::{AccountUseCases, CreateAccountCommand};
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

#[tauri::command]
pub async fn create_account(
    cmd: CreateAccountCommand,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    let account = AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .create_account(cmd).await.map_err(|e| e.to_string())?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub async fn update_account(
    id: String,
    cmd: CreateAccountCommand,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    use uuid::Uuid;
    use std::str::FromStr;
    
    let account_id = Uuid::from_str(&id).map_err(|e| e.to_string())?;
    let account = AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .update_account(domain::shared::AccountId(account_id), cmd).await.map_err(|e| e.to_string())?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub async fn delete_account(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    use uuid::Uuid;
    use std::str::FromStr;
    
    let account_id = domain::shared::AccountId(Uuid::from_str(&id).map_err(|e| e.to_string())?);
    AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .delete_account(account_id).await.map_err(|e| e.to_string())?;
    Ok(())
}
