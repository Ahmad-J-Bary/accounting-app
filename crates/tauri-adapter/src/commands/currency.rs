use tauri::State;
use application::dto::currency_dto::{CreateCurrencyDto, UpdateCurrencyDto, SetExchangeRateDto, CurrencyDto, ExchangeRateDto, TodayRateStatusDto, CurrencyContextDto};
use application::errors::AppError;
use application::world_currencies::WorldCurrency;
use crate::bootstrap::container::AppState;

#[tauri::command]
pub async fn list_currencies(
    state: State<'_, AppState>,
) -> Result<Vec<CurrencyDto>, String> {
    state.currency_queries.list_all().await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn list_active_currencies(
    state: State<'_, AppState>,
) -> Result<Vec<CurrencyDto>, String> {
    state.currency_queries.list_active().await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn create_currency(
    dto: CreateCurrencyDto,
    state: State<'_, AppState>,
) -> Result<CurrencyDto, String> {
    state.currency_commands.create_currency(dto).await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn update_currency(
    dto: UpdateCurrencyDto,
    state: State<'_, AppState>,
) -> Result<CurrencyDto, String> {
    state.currency_commands.update_currency(dto).await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn set_base_currency(
    code: String,
    state: State<'_, AppState>,
) -> Result<CurrencyDto, String> {
    state.currency_commands.set_base_currency(&code).await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn delete_currency(
    code: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.currency_commands.delete_currency(&code).await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn get_today_rates_status(
    state: State<'_, AppState>,
) -> Result<Vec<TodayRateStatusDto>, String> {
    state.currency_queries.get_today_rates_status().await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn get_currency_context(
    state: State<'_, AppState>,
) -> Result<CurrencyContextDto, String> {
    state.currency_queries.get_currency_context().await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn set_exchange_rate(
    dto: SetExchangeRateDto,
    state: State<'_, AppState>,
) -> Result<ExchangeRateDto, String> {
    state.currency_commands.set_exchange_rate(dto).await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn list_rate_history(
    from: String,
    to: String,
    limit: i32,
    state: State<'_, AppState>,
) -> Result<Vec<ExchangeRateDto>, String> {
    state.currency_queries.list_rate_history(&from, &to, limit).await.map_err(|e: AppError| e.to_string())
}
#[tauri::command]
pub async fn get_latest_exchange_rate(
    from: String,
    to: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.currency_queries.get_latest_rate(&from, &to).await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn get_world_currencies(
    state: State<'_, AppState>,
) -> Result<Vec<WorldCurrency>, String> {
    Ok(state.currency_setup.get_world_currencies())
}

#[tauri::command]
pub async fn is_setup_complete(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state.currency_setup.is_setup_complete().await.map_err(|e: AppError| e.to_string())
}

#[tauri::command]
pub async fn setup_currencies(
    base_code: String,
    secondary_code: Option<String>,
    state: State<'_, AppState>,
) -> Result<CurrencyContextDto, String> {
    state.currency_setup.setup_currencies(&base_code, secondary_code.as_deref()).await.map_err(|e: AppError| e.to_string())
}
