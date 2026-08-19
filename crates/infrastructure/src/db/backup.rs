//! Database backup / restore / integrity helpers.
//!
//! The live database is a WAL-mode SQLite file opened by a connection pool, so
//! the on-disk `*.db` file alone is never a consistent snapshot. Consistent
//! snapshots are produced with `VACUUM INTO`, which writes a self-contained,
//! compacted copy that reflects a single committed state.
//!
//! Restore is restart-based: a validated copy is staged to `<data_dir>/erp.pending.sqlite`
//! and a marker file is written; on the next app startup the swap happens
//! *before* the connection pool is opened, so the file replacement is safe on
//! every platform. Fresh migrations + integrity checks then run against the
//! restored file through the normal startup path.
//!
//! All settings live in the `app_config` key/value table (see migration 163).

use std::path::{Path, PathBuf};
use crate::sqlx;
use sqlx::SqlitePool;

/// Escape an SQL string literal by doubling single quotes.
fn quote_sql_literal(value: &str) -> String {
    value.replace('\'', "''")
}

/// Produce a consistent, self-contained snapshot of `pool`'s database at `dest`.
///
/// Uses `VACUUM INTO`, which is the SQLite online-backup/compaction command and
/// works while other pooled connections are active. The destination is removed
/// first because `VACUUM INTO` requires a nonexistent or empty target.
pub async fn create_snapshot(pool: &SqlitePool, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create snapshot dir: {e}"))?;
    }
    let _ = std::fs::remove_file(dest);
    let escaped = quote_sql_literal(&dest.to_string_lossy());
    sqlx::query(&format!("VACUUM INTO '{escaped}'"))
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to create snapshot: {e}"))?;
    Ok(())
}

/// `PRAGMA integrity_check`. Returns `Ok(())` when every row equals `ok` (or no rows).
pub async fn integrity_check(pool: &SqlitePool) -> Result<(), String> {
    let rows: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to run integrity_check: {e}"))?;
    let bad: Vec<String> = rows.into_iter().filter(|r| r.trim() != "ok").collect();
    if bad.is_empty() {
        Ok(())
    } else {
        Err(format!("Database integrity check failed: {}", bad.join(" | ")))
    }
}

/// `PRAGMA quick_check`. A faster, slightly weaker variant used at startup.
pub async fn quick_check(pool: &SqlitePool) -> Result<(), String> {
    let rows: Vec<String> = sqlx::query_scalar("PRAGMA quick_check")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to run quick_check: {e}"))?;
    let bad: Vec<String> = rows.into_iter().filter(|r| r.trim() != "ok").collect();
    if bad.is_empty() {
        Ok(())
    } else {
        Err(format!("Database quick_check failed: {}", bad.join(" | ")))
    }
}

/// Read a value from the `app_config` key/value table.
pub async fn get_config(pool: &SqlitePool, key: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar("SELECT value FROM app_config WHERE key = ?1")
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Failed to read app_config[{key}]: {e}"))
}

/// Upsert a value into the `app_config` key/value table.
pub async fn set_config(pool: &SqlitePool, key: &str, value: &str) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO app_config (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to write app_config[{key}]: {e}"))?;
    Ok(())
}

/// Default backup file name prefix (matching `*_timestamp.sqlite`).
pub const BACKUP_PREFIX: &str = "erp_backup_";

/// Resolve the backup directory: same location as the DB by default, otherwise
/// a user-configured custom path.
pub fn resolve_backup_dir(
    db_path: &Path,
    use_same_location: bool,
    custom_path: Option<&str>,
) -> PathBuf {
    if use_same_location || custom_path.map(str::trim).unwrap_or("").is_empty() {
        db_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."))
    } else {
        PathBuf::from(custom_path.unwrap_or(""))
    }
}

/// Current local timestamp in `YYYYMMDD_HHMMSS` form.
pub fn timestamp_token() -> String {
    chrono::Local::now().format("%Y%m%d_%H%M%S").to_string()
}

/// Build a timestamped backup filename, e.g. `erp_backup_20260819_093000.sqlite`.
pub fn backup_filename(prefix: &str) -> String {
    format!("{prefix}{}.sqlite", timestamp_token())
}

/// Metadata describing a single backup file.
#[derive(Debug, Clone, serde::Serialize)]
pub struct BackupFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub label: String,
    pub timestamp: i64,
}

/// List all `BACKUP_PREFIX*.sqlite` files in `dir`, newest first.
pub fn list_backup_files(dir: &Path) -> Result<Vec<BackupFileInfo>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut files: Vec<BackupFileInfo> = Vec::new();
    for entry in std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .flatten()
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if !name.starts_with(BACKUP_PREFIX) || !name.ends_with(".sqlite") {
            continue;
        }
        let ts = path
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let size = path.metadata().map(|m| m.len()).unwrap_or(0);
        files.push(BackupFileInfo {
            label: name
                .trim_start_matches(BACKUP_PREFIX)
                .trim_end_matches(".sqlite")
                .to_string(),
            name,
            path: path.to_string_lossy().to_string(),
            size,
            timestamp: ts,
        });
    }
    files.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(files)
}

/// Delete backups older than `retention_days` days. `0` keeps everything.
pub fn cleanup_old_backups(dir: &Path, retention_days: u64) -> Result<usize, String> {
    if retention_days == 0 || !dir.exists() {
        return Ok(0);
    }
    let now = chrono::Local::now();
    let mut removed = 0;
    for entry in std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read backup dir: {e}"))?
        .flatten()
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        if !name.starts_with(BACKUP_PREFIX) {
            continue;
        }
        if let Ok(meta) = path.metadata() {
            if let Ok(modified) = meta.modified() {
                if let Ok(age) = now
                    .signed_duration_since(chrono::DateTime::<chrono::Local>::from(modified))
                    .to_std()
                {
                    if age > chrono::Duration::days(retention_days as i64).to_std().map_err(|e| e.to_string())? {
                        if std::fs::remove_file(&path).is_ok() {
                            removed += 1;
                        }
                    }
                }
            }
        }
    }
    Ok(removed)
}

/// Copy a standalone SQLite snapshot over the live DB path, deleting any stale
/// WAL/SHM side files. Only call this while NO connections are open.
pub fn replace_db_file(db_path: &Path, source: &Path) -> Result<(), String> {
    if !source.exists() {
        return Err("Restore source file does not exist".into());
    }
    let tmp = db_path.with_extension("db.restore");
    let _ = std::fs::remove_file(&tmp);
    std::fs::copy(source, &tmp).map_err(|e| format!("Failed to copy restore file: {e}"))?;

    let wal = format!("{}-wal", db_path.to_string_lossy());
    let shm = format!("{}-shm", db_path.to_string_lossy());
    let _ = std::fs::remove_file(&wal);
    let _ = std::fs::remove_file(&shm);

    if db_path.exists() {
        std::fs::rename(db_path, db_path.with_extension("db.pre_restore"))
            .map_err(|e| format!("Failed to move current DB aside: {e}"))?;
    }
    std::fs::rename(&tmp, db_path).map_err(|e| format!("Failed to install restored DB: {e}"))?;
    let _ = std::fs::remove_file(db_path.with_extension("db.pre_restore"));
    Ok(())
}

/// Marker file name used to scope a pending restore.
const PENDING_RESTORE_MARKER: &str = "restore.pending.json";

pub fn pending_marker_path(data_dir: &Path) -> PathBuf {
    data_dir.join(PENDING_RESTORE_MARKER)
}

/// Pending-restore marker content (JSON).
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct PendingRestore {
    pub pending_db: String,
    pub source_label: String,
    pub created_at: String,
}

/// Serialize the pending-restore marker to disk.
pub fn write_pending_marker(data_dir: &Path, pending: &PendingRestore) -> Result<(), String> {
    let json = serde_json::to_string_pretty(pending)
        .map_err(|e| format!("Failed to serialize restore marker: {e}"))?;
    std::fs::write(pending_marker_path(data_dir), json)
        .map_err(|e| format!("Failed to write restore marker: {e}"))
}

/// Read and delete the pending-restore marker.
pub fn take_pending_marker(data_dir: &Path) -> Result<Option<PendingRestore>, String> {
    let path = pending_marker_path(data_dir);
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read restore marker: {e}"))?;
    let pending: PendingRestore = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse restore marker: {e}"))?;
    std::fs::remove_file(&path).map_err(|e| format!("Failed to remove restore marker: {e}"))?;
    Ok(Some(pending))
}