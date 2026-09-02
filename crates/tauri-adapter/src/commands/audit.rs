use crate::bootstrap::container::AppState;
use application::dto::audit_dto::AuditLogDto;
use application::use_cases::audit::AuditQueries;
use tauri::State;

#[tauri::command]
pub async fn list_audit_logs(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<AuditLogDto>, String> {
    AuditQueries::new(state.audit_repo.clone())
        .list_all(limit)
        .await
        .map_err(|e| e.to_string())
}
