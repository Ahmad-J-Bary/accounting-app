use tauri::{AppHandle, Manager, State};
use std::path::{Path, PathBuf};
use std::str::FromStr as _;

use crate::bootstrap::container::AppState;
use infrastructure::db::backup::{
    self, BackupFileInfo, PendingRestore,
};

/// Resolve the live DB path (mirrors setup logic in lib.rs).
fn resolve_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    Ok(app_data_dir.join("erp.db"))
}

fn resolve_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))
}

async fn resolve_backup_dir(app: &AppHandle, state: &AppState) -> Result<PathBuf, String> {
    let db_path = resolve_db_path(app)?;
    let use_same_location = backup::get_config(&state.pool, "backup_use_same_location")
        .await
        .map(|v| v.map(|s| s == "true").unwrap_or(true))?;
    let custom_path = backup::get_config(&state.pool, "backup_custom_path").await?;
    Ok(backup::resolve_backup_dir(&db_path, use_same_location, custom_path.as_deref()))
}

/// Create a manual backup snapshot immediately.
#[tauri::command]
pub async fn backup_database_now(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BackupFileInfo, String> {
    let backup_dir = resolve_backup_dir(&app, &state).await?;
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let filename = backup::backup_filename(backup::BACKUP_PREFIX);
    let dest = backup_dir.join(&filename);
    backup::create_snapshot(&state.pool, &dest).await?;

    let meta = std::fs::metadata(&dest).map_err(|e| format!("Failed to stat backup: {e}"))?;
    let ts = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    Ok(BackupFileInfo {
        label: filename
            .trim_start_matches(backup::BACKUP_PREFIX)
            .trim_end_matches(".sqlite")
            .to_string(),
        name: filename,
        path: dest.to_string_lossy().to_string(),
        size: meta.len(),
        timestamp: ts,
    })
}

/// List existing backups from the active backup directory.
#[tauri::command]
pub async fn list_backups(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<BackupFileInfo>, String> {
    let backup_dir = resolve_backup_dir(&app, &state).await?;
    backup::list_backup_files(&backup_dir)
}

/// Get the current backup configuration (dir, retention, last auto-backup).
#[tauri::command]
pub async fn get_backup_config(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let use_same_location = backup::get_config(&state.pool, "backup_use_same_location")
        .await
        .map(|v| v.map(|s| s == "true").unwrap_or(true))?;
    let custom_path = backup::get_config(&state.pool, "backup_custom_path").await?;
    let retention = backup::get_config(&state.pool, "backup_retention_days")
        .await?
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(30);
    let auto_backup = backup::get_config(&state.pool, "backup_auto_enabled")
        .await
        .map(|v| v.map(|s| s == "true").unwrap_or(true))?;
    let last_auto = backup::get_config(&state.pool, "backup_last_auto").await?;

    let db_path = resolve_db_path(&app)?;
    let backup_dir = backup::resolve_backup_dir(&db_path, use_same_location, custom_path.as_deref());

    Ok(serde_json::json!({
        "use_same_location": use_same_location,
        "custom_path": custom_path,
        "backup_dir": backup_dir.to_string_lossy().to_string(),
        "retention_days": retention,
        "auto_backup_enabled": auto_backup,
        "last_auto_backup": last_auto,
    }))
}

/// Update backup settings.
#[tauri::command]
pub async fn set_backup_config(
    app: AppHandle,
    state: State<'_, AppState>,
    use_same_location: Option<bool>,
    custom_path: Option<String>,
    retention_days: Option<u32>,
    auto_backup_enabled: Option<bool>,
) -> Result<serde_json::Value, String> {
    if let Some(v) = use_same_location {
        backup::set_config(&state.pool, "backup_use_same_location", &v.to_string()).await?;
    }
    if let Some(v) = custom_path {
        backup::set_config(&state.pool, "backup_custom_path", &v).await?;
    }
    if let Some(v) = retention_days {
        backup::set_config(&state.pool, "backup_retention_days", &v.to_string()).await?;
    }
    if let Some(v) = auto_backup_enabled {
        backup::set_config(&state.pool, "backup_auto_enabled", &v.to_string()).await?;
    }
    get_backup_config(app, state).await
}

/// Export the live DB to a standalone snapshot file (`VACUUM INTO`).
#[tauri::command]
pub async fn export_database(
    state: State<'_, AppState>,
    dest_path: String,
) -> Result<(), String> {
    let dest = Path::new(&dest_path);
    if !dest_path.to_lowercase().ends_with(".sqlite")
        && !dest_path.to_lowercase().ends_with(".db")
    {
        return Err("فشل التصدير: يجب أن يكون الملف بصيغة .sqlite أو .db".into());
    }
    backup::create_snapshot(&state.pool, dest).await
}

/// Export the live DB to a byte array (used by the frontend to save anywhere).
#[tauri::command]
pub async fn export_database_to_bytes(state: State<'_, AppState>) -> Result<Vec<u8>, String> {
    let filename = backup::backup_filename("erp_export_");
    let tmp = std::env::temp_dir().join(filename);
    backup::create_snapshot(&state.pool, &tmp).await?;
    let bytes = std::fs::read(&tmp).map_err(|e| format!("Failed to read snapshot: {e}"))?;
    let _ = std::fs::remove_file(&tmp);
    Ok(bytes)
}

/// Verify that `path` is a valid SQLite database via a read-only pool.
async fn validate_sqlite_file(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err("الملف غير موجود".into());
    }
    let url = format!("sqlite:{}?mode=ro", path.to_string_lossy());
    let opts = infrastructure::sqlx::sqlite::SqliteConnectOptions::from_str(&url)
        .map_err(|e| format!("Invalid sqlite URL: {e}"))?;
    let pool = infrastructure::sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .map_err(|e| format!("الملف ليس قاعدة بيانات سليمة: {e}"))?;
    let result = backup::quick_check(&pool).await;
    pool.close().await;
    result
}

/// Import a database from a source file (restart-based swap).
///
/// The incoming file is copied to `<data_dir>/erp.pending.sqlite`, an
/// auto-backup of the CURRENT DB is snapshotted, and a marker is written. On
/// the next startup the pending file replaces the live DB BEFORE the pool
/// opens — the only safe way to swap a WAL-mode DB that a pool keeps open.
#[tauri::command]
pub async fn import_database(
    app: AppHandle,
    state: State<'_, AppState>,
    source_path: String,
) -> Result<serde_json::Value, String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("ملف النسخة الاحتياطية غير موجود".into());
    }

    // Make sure the incoming file is a sane SQLite DB before committing.
    validate_sqlite_file(source).await?;

    let data_dir = resolve_data_dir(&app)?;
    let pending = data_dir.join("erp.pending.sqlite");
    let _ = std::fs::remove_file(&pending);
    std::fs::copy(source, &pending)
        .map_err(|e| format!("Failed to copy restore file: {e}"))?;

    // Snapshot the CURRENT DB into an auto-backup before any swap.
    let backup_dir = resolve_backup_dir(&app, &state).await?;
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup dir: {e}"))?;
    let pre_file = backup::backup_filename("erp_pre_restore_");
    let pre_backup = backup_dir.join(&pre_file);
    backup::create_snapshot(&state.pool, &pre_backup).await?;

    let marker = PendingRestore {
        pending_db: pending.to_string_lossy().to_string(),
        source_label: source
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("backup")
            .to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
    };
    backup::write_pending_marker(&data_dir, &marker)?;

    Ok(serde_json::json!({
        "pending": marker.pending_db,
        "auto_backup": pre_backup.to_string_lossy().to_string(),
    }))
}

/// Import a database from raw bytes (restart-based swap).
#[tauri::command]
pub async fn import_database_from_bytes(
    app: AppHandle,
    state: State<'_, AppState>,
    bytes: Vec<u8>,
) -> Result<serde_json::Value, String> {
    let data_dir = resolve_data_dir(&app)?;
    let pending = data_dir.join("erp.pending.sqlite");
    std::fs::write(&pending, &bytes)
        .map_err(|e| format!("Failed to write imported database: {e}"))?;

    validate_sqlite_file(&pending).await?;

    let backup_dir = resolve_backup_dir(&app, &state).await?;
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup dir: {e}"))?;
    let pre_file = backup::backup_filename("erp_pre_restore_");
    let pre_backup = backup_dir.join(&pre_file);
    backup::create_snapshot(&state.pool, &pre_backup).await?;

    let marker = PendingRestore {
        pending_db: pending.to_string_lossy().to_string(),
        source_label: "استيراد من بايتات".to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
    };
    backup::write_pending_marker(&data_dir, &marker)?;

    Ok(serde_json::json!({
        "pending": marker.pending_db,
        "auto_backup": pre_backup.to_string_lossy().to_string(),
    }))
}

/// Read the current pending-restore status (if any).
#[tauri::command]
pub async fn pending_restore_status(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let data_dir = resolve_data_dir(&app)?;
    let marker_path = backup::pending_marker_path(&data_dir);
    if !marker_path.exists() {
        return Ok(None);
    }
    let text = std::fs::read_to_string(&marker_path)
        .map_err(|e| format!("Failed to read restore marker: {e}"))?;
    let parsed: PendingRestore = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    Ok(Some(serde_json::json!({
        "pending": parsed.pending_db,
        "source_label": parsed.source_label,
        "created_at": parsed.created_at,
    })))
}

/// Cancel a pending restore and remove the staged file + marker.
#[tauri::command]
pub async fn cancel_pending_restore(app: AppHandle) -> Result<(), String> {
    let data_dir = resolve_data_dir(&app)?;
    if let Some(pending) = backup::take_pending_marker(&data_dir)? {
        let _ = std::fs::remove_file(pending.pending_db);
    }
    Ok(())
}

/// Request an application restart (completes a staged restore on next launch).
#[tauri::command]
pub fn request_app_restart(app: AppHandle) -> Result<serde_json::Value, String> {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(200));
        tauri::process::restart(&app.env());
    });
    Ok(serde_json::json!({ "restarting": true }))
}

/// Run a full `PRAGMA integrity_check` on the live pool.
#[tauri::command]
pub async fn get_database_health(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    match backup::integrity_check(&state.pool).await {
        Ok(()) => Ok(serde_json::json!({ "status": "ok" })),
        Err(e) => Ok(serde_json::json!({ "status": "error", "message": e })),
    }
}

/// Delete a backup file from the active backup directory.
#[tauri::command]
pub async fn delete_backup_file(
    app: AppHandle,
    state: State<'_, AppState>,
    file_name: String,
) -> Result<(), String> {
    if file_name.contains("..") || file_name.contains('/') || file_name.contains('\\') {
        return Err("Invalid backup file name".into());
    }
    if !file_name.starts_with(backup::BACKUP_PREFIX) || !file_name.ends_with(".sqlite") {
        return Err("Invalid backup file name".into());
    }
    let backup_dir = resolve_backup_dir(&app, &state).await?;
    let path = backup_dir.join(&file_name);
    if !path.exists() {
        return Err("ملف النسخة الاحتياطية غير موجود".into());
    }
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete backup: {e}"))
}