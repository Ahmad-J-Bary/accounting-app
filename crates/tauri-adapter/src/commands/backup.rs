use tauri::{AppHandle, Manager, State};
use std::path::{Path, PathBuf};

use crate::bootstrap::container::AppState;
use infrastructure::db::backup::{
    self, BackupFileInfo, BackupType, DatabaseInspection, PendingRestore, RetentionPolicy,
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

async fn read_policy(state: &AppState) -> Result<RetentionPolicy, String> {
    Ok(RetentionPolicy {
        daily: config_value(&state.pool, "backup_keep_daily", RetentionPolicy::default().daily).await,
        weekly: config_value(&state.pool, "backup_keep_weekly", RetentionPolicy::default().weekly).await,
        monthly: config_value(&state.pool, "backup_keep_monthly", RetentionPolicy::default().monthly)
            .await,
    })
}

async fn config_value(pool: &infrastructure::sqlx::SqlitePool, key: &str, fallback: u32) -> u32 {
    backup::get_config(pool, key)
        .await
        .ok()
        .flatten()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(fallback)
}

/// Create a typed backup (snapshot → verify → sidecar metadata) in `dir`.
///
/// `full_verify` runs `PRAGMA integrity_check` (manual backups); cheaper
/// `quick_check` is used for automatic/pre-import snapshots.
async fn create_typed_backup(
    app: &AppHandle,
    state: &AppState,
    backup_type: BackupType,
    full_verify: bool,
) -> Result<BackupFileInfo, String> {
    let backup_dir = resolve_backup_dir(app, state).await?;
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup dir: {e}"))?;

    let filename = backup::next_backup_filename(&backup_dir, backup::BACKUP_PREFIX)?;
    let dest = backup_dir.join(&filename);

    backup::create_snapshot(&state.pool, &dest).await?;

    // Verify BEFORE declaring success — never trust fs success alone.
    let verification = match backup::verify_backup(&dest, full_verify).await {
        Ok(v) if v.full_ok() => v,
        Ok(v) => {
            let _ = std::fs::remove_file(&dest);
            let reason = if v.integrity_ok {
                format!("Missing tables: {}", v.missing_tables.join(", "))
            } else {
                "integrity check failed".to_string()
            };
            return Err(format!("فشل التحقق من النسخة الاحتياطية: {reason}"));
        }
        Err(e) => {
            let _ = std::fs::remove_file(&dest);
            return Err(format!("فشل التحقق من النسخة الاحتياطية: {e}"));
        }
    };

    let meta = backup::build_meta(&state.pool, &filename, &dest, backup_type, &verification).await;
    backup::save_sidecar(&backup_dir, &meta)
        .map_err(|e| format!("فشل حفظ بيانات النسخة الاحتياطية: {e}"))?;

    Ok(BackupFileInfo {
        label: filename
            .trim_start_matches(backup::BACKUP_PREFIX)
            .trim_end_matches(".sqlite")
            .to_string(),
        name: filename,
        path: dest.to_string_lossy().to_string(),
        size: meta.size_bytes,
        timestamp: meta.timestamp_secs,
        backup_type: meta.backup_type.clone(),
        sha256: Some(meta.sha256.clone()),
        schema_version: Some(meta.schema_version),
        app_version: Some(meta.app_version.clone()),
        company_scope: meta.company_scope.clone(),
        status: Some(meta.status.clone()),
        verified: true,
    })
}

/// Create a manual backup snapshot immediately (full integrity verification).
#[tauri::command]
pub async fn backup_database_now(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BackupFileInfo, String> {
    create_typed_backup(&app, &state, BackupType::Manual, true).await
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

/// Get the current backup configuration (dir, retention policy, last auto-backup).
#[tauri::command]
pub async fn get_backup_config(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let use_same_location = backup::get_config(&state.pool, "backup_use_same_location")
        .await
        .map(|v| v.map(|s| s == "true").unwrap_or(true))?;
    let custom_path = backup::get_config(&state.pool, "backup_custom_path").await?;
    let auto_backup = backup::get_config(&state.pool, "backup_auto_enabled")
        .await
        .map(|v| v.map(|s| s == "true").unwrap_or(true))?;
    let last_auto = backup::get_config(&state.pool, "backup_last_auto").await?;

    // Tiered policy with legacy days-based fallback: 30 days ≈ 4 weeks.
    let policy = read_policy(&state).await?;
    let legacy_days = backup::get_config(&state.pool, "backup_retention_days")
        .await?
        .and_then(|s| s.parse::<u32>().ok());
    let (daily, weekly, monthly) = if policy == RetentionPolicy::default()
        && legacy_days.is_some()
        && legacy_days != Some(30)
    {
        (0u32, legacy_days.unwrap_or(0) / 7, 0u32)
    } else {
        (policy.daily, policy.weekly, policy.monthly)
    };

    let db_path = resolve_db_path(&app)?;
    let backup_dir = backup::resolve_backup_dir(&db_path, use_same_location, custom_path.as_deref());
    let last_restore_status = backup::get_config(&state.pool, "backup_last_restore_status").await?;

    Ok(serde_json::json!({
        "use_same_location": use_same_location,
        "custom_path": custom_path,
        "backup_dir": backup_dir.to_string_lossy().to_string(),
        "keep_daily": daily,
        "keep_weekly": weekly,
        "keep_monthly": monthly,
        "auto_backup_enabled": auto_backup,
        "last_auto_backup": last_auto,
        "last_restore_status": last_restore_status,
    }))
}

/// Update backup settings.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn set_backup_config(
    app: AppHandle,
    state: State<'_, AppState>,
    use_same_location: Option<bool>,
    custom_path: Option<String>,
    keep_daily: Option<u32>,
    keep_weekly: Option<u32>,
    keep_monthly: Option<u32>,
    auto_backup_enabled: Option<bool>,
) -> Result<serde_json::Value, String> {
    if let Some(v) = use_same_location {
        backup::set_config(&state.pool, "backup_use_same_location", &v.to_string()).await?;
    }
    if let Some(v) = custom_path {
        let trimmed = v.trim().to_string();
        if !trimmed.is_empty() {
            // Validate the custom directory is creatable now, fail fast.
            std::fs::create_dir_all(&trimmed)
                .map_err(|e| format!("تعذر استخدام المجلد المخصص ({e})"))?;
        }
        backup::set_config(&state.pool, "backup_custom_path", &trimmed).await?;
    }
    if let Some(v) = keep_daily {
        backup::set_config(&state.pool, "backup_keep_daily", &v.to_string()).await?;
    }
    if let Some(v) = keep_weekly {
        backup::set_config(&state.pool, "backup_keep_weekly", &v.to_string()).await?;
    }
    if let Some(v) = keep_monthly {
        backup::set_config(&state.pool, "backup_keep_monthly", &v.to_string()).await?;
    }
    if let Some(v) = auto_backup_enabled {
        backup::set_config(&state.pool, "backup_auto_enabled", &v.to_string()).await?;
    }
    // Enforce the new policy immediately.
    let _ = apply_retention_impl(&app, &state).await;
    get_backup_config(app, state).await
}

/// Apply the retained-policy cleanup now and report how many backups were removed.
#[tauri::command]
pub async fn apply_backup_retention(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    apply_retention_impl(&app, &state).await
}

async fn apply_retention_impl(
    app: &AppHandle,
    state: &AppState,
) -> Result<serde_json::Value, String> {
    let backup_dir = resolve_backup_dir(app, state).await?;
    let backups = backup::list_backup_files(&backup_dir)?;
    let policy = read_policy(state).await?;
    let removed = backup::apply_retention(&backup_dir, policy, &backups)?;
    Ok(serde_json::json!({ "removed": removed }))
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
    let filename = backup::backup_filename(backup::EXPORT_PREFIX);
    let tmp = std::env::temp_dir().join(filename);
    backup::create_snapshot(&state.pool, &tmp).await?;
    let bytes = std::fs::read(&tmp).map_err(|e| format!("Failed to read snapshot: {e}"))?;
    let _ = std::fs::remove_file(&tmp);
    Ok(bytes)
}

/// Read-only metadata about a candidate import file (shown to the user before
/// import so they can confirm what they're restoring).
#[tauri::command]
pub async fn inspect_database_file(
    source_path: String,
) -> Result<DatabaseInspection, String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("ملف النسخة الاحتياطية غير موجود".into());
    }
    backup::inspect_database_file(source).await
}

/// Stage a source file/bytes for restart-based restore.
///
/// Order matters and is enforced for safety:
/// 1. Snapshot the CURRENT DB into a typed pre-import backup (kept forever) —
///    the user always has a rollback copy BEFORE the incoming file is touched.
/// 2. Validate the candidate on a throwaway copy (migrations, integrity, FK,
///    posted-entry balance) — an invalid DB is rejected here and *nothing*
///    about the current state changes.
/// 3. Only then copy to `erp.pending.sqlite` and write the restart marker.
async fn stage_restore(
    app: &AppHandle,
    state: &AppState,
    source: &Path,
    source_label: &str,
) -> Result<serde_json::Value, String> {
    // 1) Safety snapshot of the CURRENT DB first (untrimmed by retention).
    let pre = create_typed_backup(app, state, BackupType::PreImport, false).await?;

    // 2) Validate the candidate on a throwaway copy — reject before staging.
    let report = backup::validate_import_candidate(source).await?;
    if !report.ok {
        return Err(format!(
            "رُفض الاستيراد — والنسخة الاحتياطية التلقائية محفوظة: {}",
            report.errors.join(" | ")
        ));
    }

    // 3) Copy the validated file and write the restart marker.
    let data_dir = resolve_data_dir(app)?;
    let pending = data_dir.join("erp.pending.sqlite");
    let _ = std::fs::remove_file(&pending);
    std::fs::copy(source, &pending)
        .map_err(|e| format!("Failed to copy restore file: {e}"))?;

    let marker = PendingRestore {
        pending_db: pending.to_string_lossy().to_string(),
        source_label: source_label.to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
    };
    backup::write_pending_marker(&data_dir, &marker)?;

    Ok(serde_json::json!({
        "pending": marker.pending_db,
        "auto_backup": pre.path,
        "report": report,
    }))
}

/// Import a database from a source file (restart-based swap).
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
    let label = source
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("backup")
        .to_string();
    stage_restore(&app, &state, source, &label).await
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
    stage_restore(&app, &state, &pending, "استيراد من بايتات").await
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

/// Delete a backup file (and its sidecar) from the active backup directory.
#[tauri::command]
pub async fn delete_backup_file(
    app: AppHandle,
    state: State<'_, AppState>,
    file_name: String,
) -> Result<(), String> {
    if file_name.contains("..") || file_name.contains('/') || file_name.contains('\\') {
        return Err("Invalid backup file name".into());
    }
    if !backup::is_backup_name(&file_name) || !file_name.ends_with(".sqlite") {
        return Err("Invalid backup file name".into());
    }
    let backup_dir = resolve_backup_dir(&app, &state).await?;
    let path = backup_dir.join(&file_name);
    if !path.exists() {
        return Err("ملف النسخة الاحتياطية غير موجود".into());
    }
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete backup: {e}"))?;
    let _ = std::fs::remove_file(backup::sidecar_path(&backup_dir, &file_name));
    Ok(())
}