use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::settings_use_cases::{GetSettingsUseCase, UpdateSettingsUseCase};
use application::dto::settings_dto::{CompanySettingsDto, UpdateSettingsRequest};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<CompanySettingsDto, String> {
    GetSettingsUseCase::new(state.settings_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_settings(
    request: UpdateSettingsRequest,
    state: State<'_, AppState>,
) -> Result<CompanySettingsDto, String> {
    UpdateSettingsUseCase::new(state.settings_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}
