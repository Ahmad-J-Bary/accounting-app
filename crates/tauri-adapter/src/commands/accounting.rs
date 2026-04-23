use tauri::State;

use crate::bootstrap::container::AppState;
use application::dto::account_dto::{AccountDto, AccountLedgerDto};
use application::use_cases::account_use_cases::{AccountUseCases, CreateAccountCommand};
use application::use_cases::get_account_ledger::GetAccountLedgerUseCase;
use application::use_cases::get_chart_of_accounts::GetChartOfAccountsUseCase;
use domain::shared::AccountId;
use std::str::FromStr;
use uuid::Uuid;

#[tauri::command]
pub async fn get_chart_of_accounts(state: State<'_, AppState>) -> Result<Vec<AccountDto>, String> {
    GetChartOfAccountsUseCase::new(state.account_repo.clone())
        .execute()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_account_ledger(
    account_id: String,
    state: State<'_, AppState>,
) -> Result<AccountLedgerDto, String> {
    GetAccountLedgerUseCase::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .execute(account_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_account(
    cmd: CreateAccountCommand,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    let use_cases =
        AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone());

    let account = use_cases
        .create_account(cmd)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AccountDto::from(account))
}

#[tauri::command]
pub async fn update_account(
    id: String,
    cmd: CreateAccountCommand,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    let account_id = AccountId(Uuid::from_str(&id).map_err(|e| e.to_string())?);

    let use_cases =
        AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone());

    let account = use_cases
        .update_account(account_id, cmd)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AccountDto::from(account))
}

#[tauri::command]
pub async fn delete_account(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let account_id = AccountId(Uuid::from_str(&id).map_err(|e| e.to_string())?);

    let use_cases =
        AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone());

    use_cases
        .delete_account(account_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn activate_account(
    id: String,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    let account_id = AccountId(Uuid::from_str(&id).map_err(|e| e.to_string())?);

    let use_cases =
        AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone());

    let account = use_cases
        .set_account_active(account_id, true)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AccountDto::from(account))
}

#[tauri::command]
pub async fn deactivate_account(
    id: String,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    let account_id = AccountId(Uuid::from_str(&id).map_err(|e| e.to_string())?);

    let use_cases =
        AccountUseCases::new(state.account_repo.clone(), state.journal_entry_repo.clone());

    let account = use_cases
        .set_account_active(account_id, false)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AccountDto::from(account))
}
