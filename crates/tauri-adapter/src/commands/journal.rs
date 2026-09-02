use crate::bootstrap::container::AppState;
use application::dto::journal_entry_dto::{CreateJournalEntryRequest, JournalEntryDto};
use application::use_cases::journal::{
    CreateJournalEntryUseCase, ListJournalEntriesUseCase, PostJournalEntryUseCase,
    ReverseJournalEntryUseCase,
};
use tauri::State;

#[tauri::command]
pub async fn create_journal_entry(
    request: CreateJournalEntryRequest,
    state: State<'_, AppState>,
) -> Result<JournalEntryDto, String> {
    CreateJournalEntryUseCase::new(state.journal_entry_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_journal_entries(
    from_date: Option<String>,
    to_date: Option<String>,
    journal_type: Option<domain::accounting::JournalType>,
    account_id: Option<String>,
    partner_id: Option<String>,
    status: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<JournalEntryDto>, String> {
    ListJournalEntriesUseCase::new(state.journal_entry_repo.clone(), state.account_repo.clone())
        .execute(
            from_date,
            to_date,
            journal_type,
            account_id,
            partner_id,
            status,
        )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_posted_journal_entries(
    from_date: Option<String>,
    to_date: Option<String>,
    account_id: Option<String>,
    partner_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<JournalEntryDto>, String> {
    ListJournalEntriesUseCase::new(state.journal_entry_repo.clone(), state.account_repo.clone())
        .execute_posted(from_date, to_date, account_id, partner_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_journal_entry_details(
    id: String,
    state: State<'_, AppState>,
) -> Result<JournalEntryDto, String> {
    ListJournalEntriesUseCase::new(state.journal_entry_repo.clone(), state.account_repo.clone())
        .get_details(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_journal_entry(
    entry_id: String,
    state: State<'_, AppState>,
) -> Result<JournalEntryDto, String> {
    PostJournalEntryUseCase::new(state.journal_entry_repo.clone())
        .execute(entry_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reverse_journal_entry(
    entry_id: String,
    state: State<'_, AppState>,
) -> Result<JournalEntryDto, String> {
    ReverseJournalEntryUseCase::new(state.journal_entry_repo.clone())
        .execute(entry_id)
        .await
        .map_err(|e| e.to_string())
}
