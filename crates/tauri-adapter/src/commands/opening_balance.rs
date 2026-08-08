use crate::bootstrap::container::AppState;
use application::use_cases::opening_balance::{
    AllocateNetProfitCommand, AllocateNetProfitUseCase,
    ApproveOpeningBalanceUseCase, CancelOpeningBalanceUseCase,
    ComputeNetProfitCommand, ComputeNetProfitUseCase, ComputedNetProfitDto,
    CreateOpeningBalanceMigrationCommand,
    CreateOpeningBalanceUseCase, GetOpeningReconciliationUseCase, ListOpeningMigrationsUseCase,
    LockOpeningBalanceUseCase, NetProfitAllocationDto, OpeningDetailsDto, OpeningMigrationDto,
    OpeningReconciliationDto, PostOpeningBalanceResult, PostOpeningBalanceUseCase,
    ReopenOpeningBalanceUseCase, SaveOpeningDetailsCommand, SaveOpeningDetailsUseCase,
    SetResidualClassificationCommand, SetResidualClassificationUseCase,
    ValidateOpeningBalanceUseCase,
};
use tauri::State;

#[tauri::command]
pub async fn create_opening_balance_migration(
    state: State<'_, AppState>,
    request: CreateOpeningBalanceMigrationCommand,
) -> Result<OpeningMigrationDto, String> {
    CreateOpeningBalanceUseCase::new(state.opening_migration_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_opening_balance_migrations(
    state: State<'_, AppState>,
) -> Result<Vec<OpeningMigrationDto>, String> {
    ListOpeningMigrationsUseCase::new(state.opening_migration_repo.clone())
        .execute()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn post_opening_balance_migration(
    state: State<'_, AppState>,
    id: String,
) -> Result<PostOpeningBalanceResult, String> {
    PostOpeningBalanceUseCase::new(
        state.opening_migration_repo.clone(),
        state.opening_detail_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
        state.opening_posting_repo.clone(),
    )
    .execute(id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn allocate_net_profit(
    state: State<'_, AppState>,
    request: AllocateNetProfitCommand,
) -> Result<NetProfitAllocationDto, String> {
    AllocateNetProfitUseCase::new(
        state.opening_migration_repo.clone(),
        state.partner_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compute_opening_balance_net_profit(
    state: State<'_, AppState>,
    request: ComputeNetProfitCommand,
) -> Result<ComputedNetProfitDto, String> {
    ComputeNetProfitUseCase::new(
        state.opening_migration_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(request)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_opening_balance_migration(
    state: State<'_, AppState>,
    id: String,
) -> Result<OpeningMigrationDto, String> {
    CancelOpeningBalanceUseCase::new(
        state.opening_migration_repo.clone(),
        state.journal_entry_repo.clone(),
        state.opening_posting_repo.clone(),
    )
    .execute(id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reopen_opening_balance_migration(
    state: State<'_, AppState>,
    id: String,
) -> Result<OpeningMigrationDto, String> {
    ReopenOpeningBalanceUseCase::new(state.opening_migration_repo.clone())
.execute(id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_opening_balance_residual_classification(
    state: State<'_, AppState>,
    request: SetResidualClassificationCommand,
) -> Result<(), String> {
    SetResidualClassificationUseCase::new(state.opening_migration_repo.clone())
        .execute(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_opening_balance_migration(
    state: State<'_, AppState>,
    id: String,
    by: String,
) -> Result<OpeningMigrationDto, String> {
    ValidateOpeningBalanceUseCase::new(state.opening_migration_repo.clone())
        .execute(id, by)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn approve_opening_balance_migration(
    state: State<'_, AppState>,
    id: String,
    by: String,
) -> Result<OpeningMigrationDto, String> {
    ApproveOpeningBalanceUseCase::new(state.opening_migration_repo.clone())
        .execute(id, by)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn lock_opening_balance_migration(
    state: State<'_, AppState>,
    id: String,
) -> Result<OpeningMigrationDto, String> {
    LockOpeningBalanceUseCase::new(
        state.opening_migration_repo.clone(),
        state.opening_detail_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(id)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_opening_balance_details(
    state: State<'_, AppState>,
    command: SaveOpeningDetailsCommand,
) -> Result<OpeningDetailsDto, String> {
    SaveOpeningDetailsUseCase::new(
        state.opening_migration_repo.clone(),
        state.opening_detail_repo.clone(),
    )
    .execute(command)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_opening_balance_reconciliation(
    state: State<'_, AppState>,
    id: String,
) -> Result<OpeningReconciliationDto, String> {
    GetOpeningReconciliationUseCase::new(
        state.opening_migration_repo.clone(),
        state.opening_detail_repo.clone(),
        state.account_repo.clone(),
        state.journal_entry_repo.clone(),
    )
    .execute(id)
    .await
    .map_err(|e| e.to_string())
}