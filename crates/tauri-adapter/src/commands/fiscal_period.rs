use crate::bootstrap::container::AppState;
use application::use_cases::fiscal_period::{
    CloseFiscalPeriodCommand, CloseFiscalPeriodUseCase, ComputePeriodNetProfitUseCase,
    ComputePeriodProfitCommand, ComputedPeriodProfitDto, CreateFiscalPeriodCommand,
    CreateFiscalPeriodUseCase, DistributableProfitDto, FiscalPeriodDto,
    GetDistributableProfitUseCase, ListFiscalPeriodsUseCase,
};
use tauri::State;

#[tauri::command]
pub async fn create_fiscal_period(
    state: State<'_, AppState>,
    request: CreateFiscalPeriodCommand,
) -> Result<FiscalPeriodDto, String> {
    CreateFiscalPeriodUseCase::new(state.fiscal_period_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_fiscal_periods(
    state: State<'_, AppState>,
) -> Result<Vec<FiscalPeriodDto>, String> {
    ListFiscalPeriodsUseCase::new(state.fiscal_period_repo.clone())
        .execute()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_fiscal_period(
    state: State<'_, AppState>,
    request: CloseFiscalPeriodCommand,
) -> Result<FiscalPeriodDto, String> {
    CloseFiscalPeriodUseCase::new(state.fiscal_period_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compute_period_net_profit(
    state: State<'_, AppState>,
    request: ComputePeriodProfitCommand,
) -> Result<ComputedPeriodProfitDto, String> {
    ComputePeriodNetProfitUseCase::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_distributable_profit(
    state: State<'_, AppState>,
    period_start: String,
    period_end: String,
) -> Result<DistributableProfitDto, String> {
    GetDistributableProfitUseCase::new(state.account_repo.clone(), state.journal_entry_repo.clone())
        .execute(period_start, period_end)
        .await
        .map_err(|e| e.to_string())
}