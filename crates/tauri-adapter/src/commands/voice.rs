use tauri::State;

use crate::bootstrap::container::AppState;
use application::dto::voice_dto::{
    VoiceCommandDto, VoiceExecutionResultDto, VoiceIntentRequest, VoicePreviewDto,
};
use application::use_cases::voice::{ExecuteVoiceCommandUseCase, PreviewVoiceIntentUseCase};
use domain::shared::ExecutionContext;

#[tauri::command]
pub async fn preview_voice_intent(request: VoiceIntentRequest) -> Result<VoicePreviewDto, String> {
    PreviewVoiceIntentUseCase::new()
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_voice_command(
    state: State<'_, AppState>,
    command: VoiceCommandDto,
    context: ExecutionContext,
) -> Result<VoiceExecutionResultDto, String> {
    ExecuteVoiceCommandUseCase::new(state.search_providers.clone())
        .execute(command, context)
        .await
        .map_err(|e| e.to_string())
}
