//! Database backup / restore / integrity helpers.
//!
//! The live database is a WAL-mode SQLite file opened by a connection pool, so
//! the on-disk `*.db` file alone is never a consistent snapshot. Consistent
//! snapshots are produced with `VACUUM INTO`, which writes a self-contained,
//! compacted copy that reflects a single committed state.
//!
//! Every backup is verified after creation (read-only open, integrity check and
//! expected accounting tables) and described by a sidecar JSON metadata file
//! (`<name>.meta.json`) containing a SHA-256 checksum, backup type, schema and
//! application versions, company scope and status. The sidecar keeps metadata
//! out of the live accounting schema (see `app_config`, migration 163, for
//! user-level backup settings).
//!
//! Restore is restart-based: a validated copy is staged to `<data_dir>/erp.pending.sqlite`
//! and a marker file is written; on the next app startup the swap happens
//! *before* the connection pool is opened, so the file replacement is safe on
//! every platform. Fresh migrations + integrity checks then run against the
//! restored file through the normal startup path.
//!
//! Retention is tiered: among automatically-created backups only, the newest
//! [RETENTION_POLICY_DEFAULT.daily] day-buckets, `weekly` week-buckets and
//! `monthly` month-buckets are kept. Manual and pre-import backups are kept
//! until explicitly deleted by the user.

use std::path::{Path, PathBuf};
use std::str::FromStr as _;

use chrono::Datelike;
use crate::sqlx;
use sqlx::SqlitePool;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sha2::{Digest, Sha256};

/// Canonical backup file name prefix, e.g. `accounting_backup_20260819_093000.sqlite`.
pub const BACKUP_PREFIX: &str = "accounting_backup_";
/// Legacy prefixes recognized so existing backups remain visible/deletable.
pub const LEGACY_PREFIXES: [&str; 2] = ["erp_backup_", "erp_pre_restore_"];
/// Prefix for user-initiated export files.
pub const EXPORT_PREFIX: &str = "accounting_export_";

/// Accounting tables that a valid backup must contain.
pub const EXPECTED_TABLES: [&str; 10] = [
    "accounts",
    "journal_entries",
    "journal_lines",
    "unified_invoices",
    "unified_invoice_lines",
    "materials",
    "partners",
    "settings",
    "app_config",
    "_sqlx_migrations",
];

// ─── Naming & snapshots ────────────────────────────────────────────────────

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

/// Current local timestamp in `YYYYMMDD_HHMMSS` form.
pub fn timestamp_token() -> String {
    chrono::Local::now().format("%Y%m%d_%H%M%S").to_string()
}

/// Build a timestamped backup filename, e.g. `accounting_backup_20260819_093000.sqlite`.
pub fn backup_filename(prefix: &str) -> String {
    format!("{prefix}{}.sqlite", timestamp_token())
}

/// Does `name` look like a backup file we recognize?
pub fn is_backup_name(name: &str) -> bool {
    name.starts_with(BACKUP_PREFIX) || LEGACY_PREFIXES.iter().any(|p| name.starts_with(p))
}

/// Derive the backup type for a file name when no sidecar exists.
fn infer_type(name: &str) -> String {
    if name.starts_with(BACKUP_PREFIX) {
        "auto".into()
    } else if name.starts_with("erp_pre_restore_") {
        "pre_import".into()
    } else {
        "auto".into()
    }
}

/// Derive the user-facing label (timestamp token) from a backup file name.
fn label_from_name(name: &str) -> String {
    for prefix in std::iter::once(BACKUP_PREFIX).chain(LEGACY_PREFIXES.iter().copied()) {
        if let Some(rest) = name.strip_prefix(prefix) {
            return rest.trim_end_matches(".sqlite").to_string();
        }
    }
    name.trim_end_matches(".sqlite").to_string()
}

/// Produce a fresh backup filename in `dir` that does not collide with an
/// existing file. Never overwrites — retries in the next second up to a few
/// times, then fails.
pub fn next_backup_filename(dir: &Path, prefix: &str) -> Result<String, String> {
    for _ in 0..5 {
        let candidate = backup_filename(prefix);
        if !dir.join(&candidate).exists() {
            return Ok(candidate);
        }
        std::thread::sleep(std::time::Duration::from_millis(1200));
    }
    Err("Could not generate a unique backup filename (multiple backups in the same second)".into())
}

// ─── Integrity checks ──────────────────────────────────────────────────────

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

// ─── App configuration (key/value) ─────────────────────────────────────────

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

/// Current database schema version from the applied migrations ledger.
pub async fn get_schema_version(pool: &SqlitePool) -> u32 {
    sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations")
        .fetch_one(pool)
        .await
        .map(|v| v.max(0) as u32)
        .unwrap_or(0)
}

/// Company scope for backup metadata (best effort, from the settings table).
pub async fn company_scope(pool: &SqlitePool) -> Option<String> {
    sqlx::query_scalar("SELECT company_name FROM settings WHERE id = (SELECT id FROM settings LIMIT 1)")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

// ─── Directory resolution ──────────────────────────────────────────────────

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

// ─── Backup types & metadata ───────────────────────────────────────────────

/// Backup type classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum BackupType {
    /// User-initiated "إنشاء نسخة احتياطية الآن".
    Manual,
    /// Automatic (startup policy).
    Auto,
    /// Automatic safety snapshot taken before an import/restore.
    PreImport,
}

impl BackupType {
    pub fn as_str(self) -> &'static str {
        match self {
            BackupType::Manual => "manual",
            BackupType::Auto => "auto",
            BackupType::PreImport => "pre_import",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> BackupType {
        match s {
            "manual" => BackupType::Manual,
            "pre_import" => BackupType::PreImport,
            _ => BackupType::Auto,
        }
    }
}

/// Sidecar metadata describing a single backup file (`<name>.meta.json`).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupMeta {
    pub filename: String,
    pub created_at: String,
    pub timestamp_secs: i64,
    pub size_bytes: u64,
    pub backup_type: String,
    pub status: String,
    pub sha256: String,
    pub schema_version: u32,
    pub app_version: String,
    pub company_scope: Option<String>,
    pub integrity: String,
    pub tables_present: bool,
    pub verified_at: String,
}

/// Info returned to the frontend for one backup file.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackupFileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub label: String,
    pub timestamp: i64,
    /// Sidecar/derived metadata (may be absent for legacy files).
    pub backup_type: String,
    pub sha256: Option<String>,
    pub schema_version: Option<u32>,
    pub app_version: Option<String>,
    pub company_scope: Option<String>,
    pub status: Option<String>,
    pub verified: bool,
}

pub fn sidecar_path(dir: &Path, name: &str) -> PathBuf {
    dir.join(format!("{name}.meta.json"))
}

/// Streamed SHA-256 of a file.
pub fn file_sha256(path: &Path) -> Result<String, String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("Failed to open file for hashing: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("Failed to read file for hashing: {e}"))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Load a sidecar metadata file, if present.
pub fn load_sidecar(dir: &Path, name: &str) -> Option<BackupMeta> {
    let path = sidecar_path(dir, name);
    if !path.is_file() {
        return None;
    }
    let json = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&json).ok()
}

/// Persist a sidecar metadata file atomically (tmp + rename).
pub fn save_sidecar(dir: &Path, meta: &BackupMeta) -> Result<(), String> {
    let json = serde_json::to_string_pretty(meta)
        .map_err(|e| format!("Failed to serialize backup metadata: {e}"))?;
    let dest = sidecar_path(dir, &meta.filename);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {e}"))?;
    }
    let tmp = dest.with_extension("meta.json.tmp");
    std::fs::write(&tmp, json).map_err(|e| format!("Failed to write backup metadata: {e}"))?;
    std::fs::rename(&tmp, &dest).map_err(|e| format!("Failed to save backup metadata: {e}"))?;
    Ok(())
}

// ─── Verification ──────────────────────────────────────────────────────────

/// Outcome of [`verify_backup`].
#[derive(Debug, Clone)]
pub struct Verification {
    pub integrity_ok: bool,
    pub missing_tables: Vec<String>,
    pub sha256: String,
    pub verified_at: String,
}

impl Verification {
    pub fn full_ok(&self) -> bool {
        self.integrity_ok && self.missing_tables.is_empty()
    }
}

/// Verify a standalone snapshot file WITHOUT touching the live database:
/// read-only open, integrity (or quick) check, expected accounting tables, SHA.
///
/// `full = true` runs `PRAGMA integrity_check`; otherwise `quick_check`.
pub async fn verify_backup(path: &Path, full: bool) -> Result<Verification, String> {
    if !path.exists() {
        return Err("Backup file does not exist".into());
    }
    if !path.is_file() {
        return Err("Backup target is not a file".into());
    }

    let url = format!("sqlite:{}?mode=ro", path.to_string_lossy());
    let opts = SqliteConnectOptions::from_str(&url)
        .map_err(|e| format!("Invalid sqlite URL: {e}"))?
        .busy_timeout(std::time::Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .map_err(|e| format!("Backup is not a readable SQLite database: {e}"))?;

    let integrity_ok = if full {
        integrity_check(&pool).await.is_ok()
    } else {
        quick_check(&pool).await.is_ok()
    };

    let tables: Vec<String> = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'table'")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to read backup schema: {e}"))?;
    let missing_tables: Vec<String> = EXPECTED_TABLES
        .iter()
        .filter(|t| !tables.iter().any(|n| n == *t))
        .map(|t| t.to_string())
        .collect();

    pool.close().await;

    Ok(Verification {
        integrity_ok,
        missing_tables,
        sha256: file_sha256(path)?,
        verified_at: chrono::Local::now().to_rfc3339(),
    })
}

/// Build a sidecar [`BackupMeta`] for a freshly created, verified snapshot.
pub async fn build_meta(
    pool: &SqlitePool,
    filename: &str,
    path: &Path,
    backup_type: BackupType,
    verification: &Verification,
) -> BackupMeta {
    let size_bytes = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    let timestamp_secs = std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    BackupMeta {
        filename: filename.to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
        timestamp_secs,
        size_bytes,
        backup_type: backup_type.as_str().to_string(),
        status: if verification.full_ok() { "ok".into() } else { "error".into() },
        sha256: verification.sha256.clone(),
        schema_version: get_schema_version(pool).await,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        company_scope: company_scope(pool).await,
        integrity: if verification.integrity_ok {
            if verification.missing_tables.is_empty() {
                "passed".into()
            } else {
                "partial".into()
            }
        } else {
            "failed".into()
        },
        tables_present: verification.missing_tables.is_empty(),
        verified_at: verification.verified_at.clone(),
    }
}

// ─── Listing ───────────────────────────────────────────────────────────────

/// List all recognized backup files in `dir`, newest first, merging sidecars.
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
        let Some(name) = path.file_name().and_then(|n| n.to_str()).map(str::to_string) else {
            continue;
        };
        if !is_backup_name(&name) {
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

        let meta = load_sidecar(dir, &name);
        let backup_type = meta
            .as_ref()
            .map(|m| m.backup_type.clone())
            .unwrap_or_else(|| infer_type(&name));
        let verified = meta
            .as_ref()
            .map(|m| m.status == "ok" && m.tables_present)
            .unwrap_or(backup_type == "pre_import");

        files.push(BackupFileInfo {
            label: label_from_name(&name),
            name,
            path: path.to_string_lossy().to_string(),
            size,
            timestamp: ts,
            backup_type,
            sha256: meta.as_ref().map(|m| m.sha256.clone()).filter(|s| !s.is_empty()),
            schema_version: meta.as_ref().map(|m| m.schema_version),
            app_version: meta.as_ref().map(|m| m.app_version.clone()).filter(|s| !s.is_empty()),
            company_scope: meta.as_ref().and_then(|m| m.company_scope.clone()),
            status: meta.as_ref().map(|m| m.status.clone()),
            verified,
        });
    }
    files.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(files)
}

// ─── Retention ─────────────────────────────────────────────────────────────

/// Tiered retention policy: daily / weekly / monthly snapshot counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct RetentionPolicy {
    /// Keep the newest N distinct-day backups.
    pub daily: u32,
    /// Keep the newest N distinct-ISO-week backups.
    pub weekly: u32,
    /// Keep the newest N distinct-calendar-month backups.
    pub monthly: u32,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        RetentionPolicy { daily: 7, weekly: 4, monthly: 12 }
    }
}

impl RetentionPolicy {
    /// 0 for every bucket = keep everything.
    pub fn disabled(&self) -> bool {
        self.daily == 0 && self.weekly == 0 && self.monthly == 0
    }
}

/// Bucket key for a unix timestamp.
fn bucket_key(ts: i64, kind: &str) -> (i64, String) {
    let dt = match chrono::DateTime::<chrono::Utc>::from_timestamp(ts, 0) {
        Some(dt) => dt.with_timezone(&chrono::Local),
        None => return (0, "never".into()),
    };
    let key = match kind {
        "day" => dt.format("%Y-%m-%d").to_string(),
        "week" => {
            let w = dt.iso_week();
            format!("{}-W{:02}", w.year(), w.week())
        }
        _ => dt.format("%Y-%m").to_string(),
    };
    (ts, key)
}

/// Compute identifiers of [`BackupFileInfo`] that must survive retention.
/// Only `auto` backups are eligible for trimming; `manual` and `pre_import`
/// backups are always kept. For each bucket kind, keeps the newest backup of
/// each of the N newest buckets.
pub fn retention_keep_set(
    backups: &[BackupFileInfo],
    policy: RetentionPolicy,
) -> Vec<String> {
    if policy.disabled() {
        return backups
            .iter()
            .filter(|b| b.backup_type == "auto")
            .map(|b| b.name.clone())
            .collect();
    }

    let auto: Vec<&BackupFileInfo> = backups
        .iter()
        .filter(|b| b.backup_type == "auto")
        .collect();

    let mut keep: Vec<String> = Vec::new();
    for (kind, count) in [
        ("day", policy.daily),
        ("week", policy.weekly),
        ("month", policy.monthly),
    ] {
        if count == 0 {
            continue;
        }
        // Newest backup per bucket, then newest `count` buckets.
        let mut newest_per_bucket: Vec<(String, &BackupFileInfo)> = Vec::new();
        for b in auto.iter().copied() {
            let (_, key) = bucket_key(b.timestamp, kind);
            let idx = newest_per_bucket.iter().position(|(k, _)| k == &key);
            if let Some(idx) = idx {
                if b.timestamp > newest_per_bucket[idx].1.timestamp {
                    newest_per_bucket[idx].1 = b;
                }
            } else {
                newest_per_bucket.push((key, b));
            }
        }
        newest_per_bucket.sort_by(|a, b| b.1.timestamp.cmp(&a.1.timestamp));
        for (_, b) in newest_per_bucket.into_iter().take(count as usize) {
            if !keep.contains(&b.name) {
                keep.push(b.name.clone());
            }
        }
    }
    keep
}

/// Apply the tiered retention policy to `dir`, deleting both the backup file
/// and its sidecar. Manual and pre-import backups are never deleted.
/// Returns the list of deleted file names.
pub fn apply_retention(
    dir: &Path,
    policy: RetentionPolicy,
    backups: &[BackupFileInfo],
) -> Result<Vec<String>, String> {
    if policy.disabled() || backups.is_empty() {
        return Ok(Vec::new());
    }
    let keep = retention_keep_set(backups, policy);
    let mut removed = Vec::new();
    for b in backups {
        if b.backup_type != "auto" {
            continue;
        }
        if keep.contains(&b.name) {
            continue;
        }
        let path = dir.join(&b.name);
        if std::fs::remove_file(&path).is_ok() {
            let _ = std::fs::remove_file(sidecar_path(dir, &b.name));
            removed.push(b.name.clone());
        }
    }
    Ok(removed)
}

// ─── Restore ───────────────────────────────────────────────────────────────

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

#[cfg(test)]
mod tests {
    use super::*;

    fn info(name: &str, ts: i64, backup_type: &str) -> BackupFileInfo {
        BackupFileInfo {
            name: name.to_string(),
            path: name.to_string(),
            size: 0,
            label: name.to_string(),
            timestamp: ts,
            backup_type: backup_type.to_string(),
            sha256: None,
            schema_version: None,
            app_version: None,
            company_scope: None,
            status: None,
            verified: true,
        }
    }

    // Sep 1 2024 09:00 UTC and Sep 8 2024 09:00 UTC are different ISO weeks and months.
    const D1: i64 = 1725181200; // 2024-09-01
    const D2: i64 = 1725786000; // 2024-09-08
    const D3: i64 = 1728464400; // 2024-10-09

    #[test]
    fn manual_and_pre_import_always_kept() {
        let backups = vec![
            info("a_manual", D1, "manual"),
            info("a_pre", D2, "pre_import"),
            info("a_auto", D3, "auto"),
        ];
        let keep = retention_keep_set(&backups, RetentionPolicy { daily: 0, weekly: 0, monthly: 0 });
        assert!(keep.contains(&"a_auto".to_string()));
        // disabled policy keeps the auto backup too
        assert_eq!(keep.len(), 1);
    }

    #[test]
    fn keeps_newest_of_each_bucket() {
        // Two backups on the same day D1, one on D2, one on D3.
        let backups = vec![
            info("day1_old", D1 - 1000, "auto"), // older same day
            info("day1_new", D1, "auto"),
            info("day2", D2, "auto"),
            info("day3", D3, "auto"),
        ];
        let policy = RetentionPolicy { daily: 3, weekly: 1, monthly: 1 };
        let keep = retention_keep_set(&backups, policy);
        assert!(keep.contains(&"day1_new".to_string()));
        assert!(!keep.contains(&"day1_old".to_string()));
        assert!(keep.contains(&"day2".to_string()));
        assert!(keep.contains(&"day3".to_string()));
    }

    #[test]
    fn buckets_weekly_and_monthly() {
        // D1 and D2 are the same calendar month but different weeks.
        assert_ne!(bucket_key(D1, "week").1, bucket_key(D2, "week").1);
        assert_eq!(bucket_key(D1, "month").1, bucket_key(D2, "month").1);
        assert_ne!(bucket_key(D1, "month").1, bucket_key(D3, "month").1);
    }
}