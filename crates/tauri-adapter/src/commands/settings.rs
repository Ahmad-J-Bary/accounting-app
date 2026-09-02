use crate::bootstrap::container::AppState;
use application::dto::settings_dto::{CompanySettingsDto, UpdateSettingsRequest};
use application::use_cases::settings::{SettingsQueries, UpdateSettingsUseCase};
use tauri::State;

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<CompanySettingsDto, String> {
    SettingsQueries::new(state.settings_repo.clone())
        .get()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_settings(
    request: UpdateSettingsRequest,
    state: State<'_, AppState>,
) -> Result<CompanySettingsDto, String> {
    UpdateSettingsUseCase::new(state.settings_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}
