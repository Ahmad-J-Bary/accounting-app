use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::create_journal_entry::CreateJournalEntryUseCase;
use application::use_cases::post_journal_entry::PostJournalEntryUseCase;
use application::use_cases::list_journal_entries::ListJournalEntriesUseCase;
use application::dto::journal_entry_dto::{CreateJournalEntryRequest, JournalEntryDto};

#[tauri::command]
pub async fn create_journal_entry(
    request: CreateJournalEntryRequest,
    state: State<'_, AppState>,
) -> Result<JournalEntryDto, String> {
    CreateJournalEntryUseCase::new(state.journal_entry_repo.clone())
        .execute(request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_journal_entries(
    state: State<'_, AppState>,
) -> Result<Vec<JournalEntryDto>, String> {
    ListJournalEntriesUseCase::new(state.journal_entry_repo.clone())
        .execute().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_journal_entry(
    entry_id: String,
    state: State<'_, AppState>,
) -> Result<JournalEntryDto, String> {
    PostJournalEntryUseCase::new(state.journal_entry_repo.clone())
        .execute(entry_id).await.map_err(|e| e.to_string())
}

use application::use_cases::reverse_journal_entry::ReverseJournalEntryUseCase;

#[tauri::command]
pub async fn reverse_journal_entry(
    entry_id: String,
    state: State<'_, AppState>,
) -> Result<JournalEntryDto, String> {
    ReverseJournalEntryUseCase::new(state.journal_entry_repo.clone())
        .execute(entry_id).await.map_err(|e| e.to_string())
}
