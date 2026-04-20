use tauri::State;
use crate::bootstrap::container::AppState;
use application::use_cases::audit_use_cases::ListAuditLogsUseCase;
use application::dto::audit_dto::AuditLogDto;

#[tauri::command]
pub async fn list_audit_logs(
    limit: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<AuditLogDto>, String> {
    ListAuditLogsUseCase::new(state.audit_repo.clone())
        .execute(limit).await.map_err(|e| e.to_string())
}
