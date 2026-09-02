use tauri::State;

use crate::bootstrap::container::AppState;
use application::dto::platform_dto::{PlatformProfileDto, PublishingProfilesDto};
use application::use_cases::platform::{
    GetEditionProfileUseCase, GetPublishingProfilesUseCase, SaveEditionProfileUseCase,
    SavePublishingProfilesUseCase,
};

#[tauri::command]
pub async fn get_edition_profile(state: State<'_, AppState>) -> Result<PlatformProfileDto, String> {
    GetEditionProfileUseCase::new(state.app_config_repo.clone())
        .execute()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_edition_profile(
    state: State<'_, AppState>,
    dto: PlatformProfileDto,
) -> Result<PlatformProfileDto, String> {
    SaveEditionProfileUseCase::new(state.app_config_repo.clone())
        .execute(dto)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_publishing_profiles(
    state: State<'_, AppState>,
) -> Result<PublishingProfilesDto, String> {
    GetPublishingProfilesUseCase::new(state.app_config_repo.clone())
        .execute()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_publishing_profiles(
    state: State<'_, AppState>,
    dto: PublishingProfilesDto,
) -> Result<PublishingProfilesDto, String> {
    SavePublishingProfilesUseCase::new(state.app_config_repo.clone())
        .execute(dto)
        .await
        .map_err(|e| e.to_string())
}
