use tauri::State;

use crate::bootstrap::container::AppState;
use application::dto::search_dto::{SearchQueryRequest, SearchResultDto};
use application::use_cases::search::SearchUseCase;

#[tauri::command]
pub async fn search_global(
    state: State<'_, AppState>,
    request: SearchQueryRequest,
) -> Result<Vec<SearchResultDto>, String> {
    SearchUseCase::new(state.search_providers.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}
