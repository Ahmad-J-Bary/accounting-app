use tauri::State;

use crate::bootstrap::container::AppState;
use application::use_cases::fiscal_year::{
    CloseFiscalYearCommand, CloseFiscalYearUseCase, CreateFiscalYearCommand,
    CreateFiscalYearUseCase, FiscalYearDto, ListFiscalYearsUseCase, ReopenFiscalYearCommand,
    ReopenFiscalYearUseCase,
};

#[tauri::command]
pub async fn create_fiscal_year(
    state: State<'_, AppState>,
    request: CreateFiscalYearCommand,
) -> Result<FiscalYearDto, String> {
    CreateFiscalYearUseCase::new(state.fiscal_year_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_fiscal_years(state: State<'_, AppState>) -> Result<Vec<FiscalYearDto>, String> {
    ListFiscalYearsUseCase::new(state.fiscal_year_repo.clone())
        .execute()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_fiscal_year(
    state: State<'_, AppState>,
    request: CloseFiscalYearCommand,
) -> Result<FiscalYearDto, String> {
    CloseFiscalYearUseCase::new(
        state.fiscal_year_repo.clone(),
        state.fiscal_period_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reopen_fiscal_year(
    state: State<'_, AppState>,
    request: ReopenFiscalYearCommand,
) -> Result<FiscalYearDto, String> {
    ReopenFiscalYearUseCase::new(state.fiscal_year_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}
