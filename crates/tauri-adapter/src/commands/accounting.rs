use tauri::State;
use std::str::FromStr;
use uuid::Uuid;

use crate::bootstrap::container::AppState;
use application::dto::account_dto::{AccountDto, AccountLedgerDto};
use application::use_cases::account::{
    CreateAccountUseCase, UpdateAccountUseCase, DeleteAccountUseCase, AccountQueries, CreateAccountCommand
};
use domain::shared::AccountId;

#[tauri::command]
pub async fn get_chart_of_accounts(state: State<'_, AppState>) -> Result<Vec<AccountDto>, String> {
    AccountQueries::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .get_chart_of_accounts()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_expense_items(state: State<'_, AppState>) -> Result<Vec<AccountDto>, String> {
    AccountQueries::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .get_expense_items()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_account_ledger(
    account_id: String,
    state: State<'_, AppState>,
) -> Result<AccountLedgerDto, String> {
    let aid = AccountId(Uuid::from_str(&account_id).map_err(|e| e.to_string())?);
    
    let ledger = AccountQueries::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .get_ledger(&aid)
        .await
        .map_err(|e| e.to_string())?;
        
    Ok(AccountLedgerDto::from(ledger))
}

#[tauri::command]
pub async fn create_account(
    cmd: CreateAccountCommand,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    let account = CreateAccountUseCase::new(
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
        Some(state.customer_repo.clone()),
        Some(state.supplier_repo.clone()),
        state.exchange_rate_repo.clone(),
    )
    .execute(cmd)
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

    let account = UpdateAccountUseCase::new(
        state.account_repo.clone(),
        Some(state.customer_repo.clone()),
        Some(state.supplier_repo.clone()),
    )
    .execute(account_id, cmd)
    .await
    .map_err(|e| e.to_string())?;

    Ok(AccountDto::from(account))
}

#[tauri::command]
pub async fn delete_account(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let account_id = AccountId(Uuid::from_str(&id).map_err(|e| e.to_string())?);

    DeleteAccountUseCase::new(
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
        Some(state.customer_repo.clone()),
        Some(state.supplier_repo.clone()),
    )
    .delete(account_id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn activate_account(
    id: String,
    state: State<'_, AppState>,
) -> Result<AccountDto, String> {
    let account_id = AccountId(Uuid::from_str(&id).map_err(|e| e.to_string())?);

    let account = DeleteAccountUseCase::new(
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
        None,
        None,
    )
    .set_active(account_id, true)
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

    let account = DeleteAccountUseCase::new(
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
        None,
        None,
    )
    .set_active(account_id, false)
    .await
    .map_err(|e| e.to_string())?;

    Ok(AccountDto::from(account))
}
