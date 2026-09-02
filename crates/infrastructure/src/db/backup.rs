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
//! Restore is restart-based: a validated copy is staged to `<data_dir>/almowakeb.pending.sqlite`
//! and a marker file is written; on the next app startup the swap happens
//! *before* the connection pool is opened, so the file replacement is safe on
//! every platform. Fresh migrations + integrity checks then run against the
//! restored file through the normal startup path.
//!
//! Retention is tiered: among automatically-created backups only, the newest
//! [RETENTION_POLICY_DEFAULT.daily] day-buckets, `weekly` week-buckets and
//! `monthly` month-buckets are kept. Manual and pre-import backups are kept
//! until explicitly deleted by the user. Pre-import safety snapshots use the
//! dedicated [`PREIMPORT_PREFIX`] so they stay classified `pre_import` even
//! without a sidecar — retention can therefore never trim them.

use std::path::{Path, PathBuf};
use std::str::FromStr as _;

use crate::sqlx;
use chrono::Datelike;
use sha2::{Digest, Sha256};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;

/// Canonical backup file name prefix, e.g. `almowakeb_backup_20260819_093000.sqlite`.
pub const BACKUP_PREFIX: &str = "almowakeb_backup_";
/// Prefix for the untrimmed safety snapshot taken before an import/restore.
/// A dedicated prefix means the file is classified `pre_import` by name alone,
/// so retention can never delete it even if its sidecar metadata is lost.
pub const PREIMPORT_PREFIX: &str = "almowakeb_pre_restore_";
/// Legacy prefixes recognized so existing backups remain visible/deletable.
pub const LEGACY_PREFIXES: [&str; 4] = [
    "erp_backup_",
    "erp_pre_restore_",
    "accounting_backup_",
    "accounting_export_",
];
/// Prefix for user-initiated export files.
pub const EXPORT_PREFIX: &str = "almowakeb_export_";

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

/// Required tables AFTER migrations have been applied (an older schema is
/// upgraded first). Used when certifying snapshots and import candidates.
pub const REQUIRED_TABLES: [&str; 12] = [
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
    "audit_logs",
    "fiscal_periods",
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
    name.starts_with(BACKUP_PREFIX)
        || name.starts_with(PREIMPORT_PREFIX)
        || LEGACY_PREFIXES.iter().any(|p| name.starts_with(p))
}

/// Derive the backup type for a file name when no sidecar exists.
fn infer_type(name: &str) -> String {
    if name.starts_with(BACKUP_PREFIX) {
        "auto".into()
    } else if name.starts_with(PREIMPORT_PREFIX) {
        "pre_import".into()
    } else {
        // Legacy prefixes: erp_backup_ -> auto, erp_pre_restore_ -> pre_import
        if name.starts_with("erp_pre_restore_") {
            "pre_import".into()
        } else {
            "auto".into()
        }
    }
}

/// Derive the user-facing label (timestamp token) from a backup file name.
fn label_from_name(name: &str) -> String {
    // Try canonical prefixes first, then legacy prefixes
    let all_prefixes = [
        BACKUP_PREFIX,
        PREIMPORT_PREFIX,
        EXPORT_PREFIX,
        "erp_backup_",
        "erp_pre_restore_",
        "accounting_backup_",
        "accounting_export_",
    ];
    for prefix in all_prefixes {
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
        Err(format!(
            "Database integrity check failed: {}",
            bad.join(" | ")
        ))
    }
}

/// Names of tables from `required` that are absent from the database.
pub async fn missing_tables(pool: &SqlitePool, required: &[&str]) -> Result<Vec<String>, String> {
    let tables: Vec<String> =
        sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'table'")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to read schema: {e}"))?;
    Ok(required
        .iter()
        .filter(|t| !tables.iter().any(|n| n == *t))
        .map(|t| t.to_string())
        .collect())
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
    sqlx::query_scalar(
        "SELECT company_name FROM settings WHERE id = (SELECT id FROM settings LIMIT 1)",
    )
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
    /// Journal rows present in the snapshot at verification time.
    pub journal_entry_count: u64,
    /// Account rows present in the snapshot at verification time.
    pub account_count: u64,
    /// Whether every posted journal in the snapshot was balanced (debit ≈ credit).
    pub posted_balance_ok: bool,
    /// Balance-sheet deviation (only recorded on full-path verification).
    #[serde(default)]
    pub balance_deviation: Option<f64>,
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
    /// Journal rows recorded in the sidecar (None for legacy files).
    pub journal_entry_count: Option<u64>,
    /// Account rows recorded in the sidecar (None for legacy files).
    pub account_count: Option<u64>,
}

pub fn sidecar_path(dir: &Path, name: &str) -> PathBuf {
    dir.join(format!("{name}.meta.json"))
}

/// Streamed SHA-256 of a file.
pub fn file_sha256(path: &Path) -> Result<String, String> {
    use std::io::Read;
    let mut file =
        std::fs::File::open(path).map_err(|e| format!("Failed to open file for hashing: {e}"))?;
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
    /// Rows in `journal_entries` read from the snapshot.
    pub journal_entry_count: u64,
    /// Rows in `accounts` read from the snapshot.
    pub account_count: u64,
    /// Every `Posted` journal in the snapshot is balanced (debit ≈ credit).
    pub posted_balance_ok: bool,
    /// Balance-sheet deviation (Assets+Expenses − Liabilities−Equity−Revenue).
    /// Only computed on the full verification path; `None` otherwise.
    pub balance_deviation: Option<f64>,
    pub sha256: String,
    pub verified_at: String,
}

impl Verification {
    pub fn full_ok(&self) -> bool {
        self.integrity_ok && self.missing_tables.is_empty() && self.posted_balance_ok
    }
}

/// Verify a standalone snapshot file WITHOUT touching the live database:
/// read-only open, integrity (or quick) check, required accounting tables,
/// journal/account counts, per-entry balance of posted journals, SHA.
///
/// `full = true` runs `PRAGMA integrity_check` and computes the balance-sheet
/// deviation; otherwise `quick_check` is used (deviation left as `None`).
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

    let missing_tables = missing_tables(&pool, &REQUIRED_TABLES)
        .await
        .unwrap_or_default();

    let journal_entry_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&pool)
        .await
        .unwrap_or(0)
        .max(0) as u64;
    let account_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM accounts")
        .fetch_one(&pool)
        .await
        .unwrap_or(0)
        .max(0) as u64;

    let posted_balance_ok = unbalanced_posted_entries(&pool)
        .await
        .map(|v| v.is_empty())
        .unwrap_or(true);
    let balance_deviation = if full {
        accounting_equation_deviation(&pool).await.ok()
    } else {
        None
    };

    let verified = Verification {
        integrity_ok,
        missing_tables,
        journal_entry_count,
        account_count,
        posted_balance_ok,
        balance_deviation,
        sha256: file_sha256(path)?,
        verified_at: chrono::Local::now().to_rfc3339(),
    };
    pool.close().await;
    Ok(verified)
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
        status: if verification.full_ok() {
            "ok".into()
        } else {
            "error".into()
        },
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
        journal_entry_count: verification.journal_entry_count,
        account_count: verification.account_count,
        posted_balance_ok: verification.posted_balance_ok,
        balance_deviation: verification.balance_deviation,
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
        let Some(name) = path
            .file_name()
            .and_then(|n| n.to_str())
            .map(str::to_string)
        else {
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
            sha256: meta
                .as_ref()
                .map(|m| m.sha256.clone())
                .filter(|s| !s.is_empty()),
            schema_version: meta.as_ref().map(|m| m.schema_version),
            app_version: meta
                .as_ref()
                .map(|m| m.app_version.clone())
                .filter(|s| !s.is_empty()),
            company_scope: meta.as_ref().and_then(|m| m.company_scope.clone()),
            status: meta.as_ref().map(|m| m.status.clone()),
            verified,
            journal_entry_count: meta.as_ref().map(|m| m.journal_entry_count),
            account_count: meta.as_ref().map(|m| m.account_count),
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
        RetentionPolicy {
            daily: 7,
            weekly: 4,
            monthly: 12,
        }
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
pub fn retention_keep_set(backups: &[BackupFileInfo], policy: RetentionPolicy) -> Vec<String> {
    if policy.disabled() {
        return backups
            .iter()
            .filter(|b| b.backup_type == "auto")
            .map(|b| b.name.clone())
            .collect();
    }

    let auto: Vec<&BackupFileInfo> = backups.iter().filter(|b| b.backup_type == "auto").collect();

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
        newest_per_bucket.sort_by_key(|a| std::cmp::Reverse(a.1.timestamp));
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

// ─── Import inspection & validation ────────────────────────────────────────

/// Read-only inspection of a standalone database file the user wants to import.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DatabaseInspection {
    pub schema_version: u32,
    pub supported_version: u32,
    pub newer_than_supported: bool,
    pub tables_present: bool,
    pub missing_tables: Vec<String>,
    pub integrity_ok: bool,
    pub company_scope: Option<String>,
    pub size_bytes: u64,
    pub journal_entry_count: u64,
    pub account_count: u64,
    /// Filesystem creation time (unix seconds) — `None` when unavailable.
    pub created_at: Option<i64>,
    /// Filesystem last-modified time (unix seconds) — `None` when unavailable.
    pub modified_at: Option<i64>,
}

/// Result of validating an import candidate on a throwaway copy.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ValidationReport {
    pub ok: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ValidationReport {
    fn new() -> Self {
        ValidationReport {
            ok: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }
}

/// Open a single read-only connection to a standalone SQLite file.
async fn open_readonly(path: &Path) -> Result<SqlitePool, String> {
    let url = format!("sqlite:{}?mode=ro", path.to_string_lossy());
    let opts = SqliteConnectOptions::from_str(&url)
        .map_err(|e| format!("Invalid sqlite URL: {e}"))?
        .busy_timeout(std::time::Duration::from_secs(5));
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .map_err(|e| format!("الملف ليس قاعدة بيانات سليمة: {e}"))
}

/// Detect whether `db_path` is a SQLite database whose schema version is NEWER
/// than this build supports. `Ok(None)` for a file that is absent, lacks a
/// migration ledger (fresh DB), or is at a supported version.
pub async fn check_schema_block(db_path: &Path) -> Result<Option<(u32, u32)>, String> {
    if !db_path.is_file() {
        return Ok(None);
    }
    let pool = open_readonly(db_path).await?;
    let has_ledger: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(false);
    if !has_ledger {
        pool.close().await;
        return Ok(None);
    }
    let max: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(version), 0) FROM _sqlx_migrations")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    pool.close().await;
    let supported = crate::db::pool::latest_schema_version();
    if max.max(0) as u32 > supported {
        Ok(Some((max.max(0) as u32, supported)))
    } else {
        Ok(None)
    }
}

/// Read-only metadata about a candidate import file (schema version, tables,
/// integrity, counts) — never opens the live database.
pub async fn inspect_database_file(path: &Path) -> Result<DatabaseInspection, String> {
    if !path.is_file() {
        return Err("الملف غير موجود".into());
    }
    let metadata = std::fs::metadata(path).map_err(|e| format!("فشل قراءة معلومات الملف: {e}"))?;
    let size_bytes = metadata.len();
    let created_at = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let pool = open_readonly(path).await?;

    let schema_version =
        sqlx::query_scalar::<_, i64>("SELECT COALESCE(MAX(version), 0) FROM _sqlx_migrations")
            .fetch_one(&pool)
            .await
            .map(|v| v.max(0) as u32)
            .unwrap_or(0);

    let supported_version = crate::db::pool::latest_schema_version();

    let table_q: Vec<String> =
        sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'table'")
            .fetch_all(&pool)
            .await
            .unwrap_or_default();
    let missing_tables: Vec<String> = EXPECTED_TABLES
        .iter()
        .filter(|t| !table_q.iter().any(|n| n == *t))
        .map(|t| t.to_string())
        .collect();

    let integrity_ok = quick_check(&pool).await.is_ok();

    let company_scope: Option<String> = sqlx::query_scalar(
        "SELECT company_name FROM settings WHERE id = (SELECT id FROM settings LIMIT 1)",
    )
    .fetch_optional(&pool)
    .await
    .ok()
    .flatten();

    let journal_entry_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM journal_entries")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    let account_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM accounts")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);

    pool.close().await;

    Ok(DatabaseInspection {
        schema_version,
        supported_version,
        newer_than_supported: schema_version > supported_version,
        tables_present: missing_tables.is_empty(),
        missing_tables,
        integrity_ok,
        company_scope,
        size_bytes,
        created_at,
        modified_at,
        journal_entry_count: journal_entry_count.max(0) as u64,
        account_count: account_count.max(0) as u64,
    })
}

/// SQLite `PRAGMA foreign_key_check` — returns one row per FK violation.
async fn foreign_key_violations(pool: &SqlitePool) -> Result<Vec<String>, String> {
    let rows: Vec<(String, i64, String, i64)> =
        sqlx::query_as("SELECT \"table\", rowid, parent, fkid FROM pragma_foreign_key_check")
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to run foreign_key_check: {e}"))?;
    // SQLite returns rowid=0 for violations in tables WITHOUT an explicit
    // INTEGER PRIMARY KEY, so use the parent name + rowid only when meaningful.
    Ok(rows
        .iter()
        .map(|(child, rowid, parent, fkid)| format!("{child}(rowid {rowid}) → {parent}[fk {fkid}]"))
        .collect())
}

/// Posted journal entries whose `debit_base !== credit_base` beyond tolerance.
pub async fn unbalanced_posted_entries(pool: &SqlitePool) -> Result<Vec<String>, String> {
    let rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT je.entry_number,
                COALESCE(SUM(CAST(jl.debit_base AS REAL)), 0)
              - COALESCE(SUM(CAST(jl.credit_base AS REAL)), 0) AS diff
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.status = 'Posted'
         GROUP BY je.id
         HAVING ABS(diff) > 0.01
         ORDER BY je.entry_number",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to scan posted entries: {e}"))?;
    Ok(rows
        .iter()
        .map(|(n, d)| format!("{n} (فرق {:.2})", d.abs()))
        .collect())
}

/// Trial-balance deviation: Assets − Liabilities − Equity − Revenue + Expenses,
/// computed on POSTED ledger lines grouped by account type. Should be ~0 for a
/// self-consistent double-entry ledger.
pub async fn accounting_equation_deviation(pool: &SqlitePool) -> Result<f64, String> {
    let rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT a.account_type,
                COALESCE(SUM(CAST(jl.debit_base AS REAL)), 0)
              - COALESCE(SUM(CAST(jl.credit_base AS REAL)), 0) AS net
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_entry_id
         JOIN accounts a ON a.id = jl.account_id
         WHERE je.status = 'Posted'
         GROUP BY a.account_type",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to compute balance-sheet deviation: {e}"))?;

    let mut assets = 0f64;
    let mut liabilities = 0f64;
    let mut equity = 0f64;
    let mut revenue = 0f64;
    let mut expenses = 0f64;
    for (ty, net) in &rows {
        match ty.as_str() {
            "Assets" => assets += net,
            "Liabilities" => liabilities += net,
            "Equity" => equity += net,
            "Revenue" => revenue += net,
            "Expenses" => expenses += net,
            _ => {}
        }
    }
    // Assets + Expenses should equal Liabilities + Equity + Revenue.
    Ok(assets + expenses - liabilities - equity - revenue)
}

/// Validate an import/restore candidate WITHOUT touching the live database:
/// copies it to a temp file, applies migrations if supported (upgrading older
/// schema DBs), then checks integrity, foreign keys and accounting balance.
/// On failure the report is returned and nothing has been changed.
pub async fn validate_import_candidate(path: &Path) -> Result<ValidationReport, String> {
    if !path.is_file() {
        return Err("الملف غير موجود".into());
    }
    let mut report = ValidationReport::new();

    // Work on a private copy so a failed migration/validation harms nothing.
    let tmp = std::env::temp_dir().join(format!(
        "almowakeb_validate_{}_{}.sqlite",
        chrono::Local::now().format("%Y%m%d_%H%M%S"),
        uuid::Uuid::new_v4()
    ));
    let _ = std::fs::remove_file(&tmp);
    std::fs::copy(path, &tmp).map_err(|e| format!("Failed to copy candidate: {e}"))?;

    // 1) Open read-write and run migrations (applies older → supported schema).
    let url = format!("sqlite:{}?mode=rwc", tmp.to_string_lossy());
    let opts = SqliteConnectOptions::from_str(&url)
        .map_err(|e| format!("Invalid sqlite URL: {e}"))?
        .busy_timeout(std::time::Duration::from_secs(10))
        .foreign_keys(true);
    let pool = match SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
    {
        Ok(p) => p,
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            return Err(format!("الملف ليس قاعدة بيانات سليمة: {e}"));
        }
    };

    // 0) Never migrate/heal a schema newer than this build supports — doing so
    //    could DELETE unknown migration-ledger rows from a newer DB.
    if let Err(e) = crate::db::pool::ensure_schema_supported(&pool).await {
        report.errors.push(e);
        report.ok = false;
        pool.close().await;
        let _ = std::fs::remove_file(&tmp);
        return Ok(report);
    }

    if let Err(e) = crate::db::pool::run_migrations(&pool).await {
        report
            .errors
            .push(format!("فشل تطبيق ترقيات قاعدة البيانات: {e}"));
        report.ok = false;
    }

    // 1b) Required tables present after migration (explicit gate — catches files
    //     whose integrity/FK/balance checks would otherwise pass vacuously).
    match missing_tables(&pool, &REQUIRED_TABLES).await {
        Ok(missing) if !missing.is_empty() => {
            report
                .errors
                .push(format!("الجداول الأساسية مفقودة: {}", missing.join("، ")));
            report.ok = false;
        }
        Ok(_) => {}
        Err(e) => {
            report.errors.push(e);
            report.ok = false;
        }
    }

    // 2) Full integrity check.
    match integrity_check(&pool).await {
        Ok(()) => {}
        Err(e) => {
            report
                .errors
                .push(format!("فشل فحص سلامة قاعدة البيانات: {e}"));
            report.ok = false;
        }
    }

    // 3) Foreign keys.
    match foreign_key_violations(&pool).await {
        Ok(v) if !v.is_empty() => {
            report
                .errors
                .push(format!("انتهاكات علاقات (Foreign Key): {}", v.join("، ")));
            report.ok = false;
        }
        Ok(_) => {}
        Err(e) => {
            report.errors.push(e);
            report.ok = false;
        }
    }

    // 4) Per-entry balance gate on posted journals.
    match unbalanced_posted_entries(&pool).await {
        Ok(v) if !v.is_empty() => {
            report.errors.push(format!(
                "قيود مرحلة غير متوازنة (مدين ≠ دائن): {}",
                v.join("، ")
            ));
            report.ok = false;
        }
        Ok(_) => {}
        Err(e) => {
            report.errors.push(e);
            report.ok = false;
        }
    }

    // 5) Balance-sheet equation — reported as a warning, not a gate.
    match accounting_equation_deviation(&pool).await {
        Ok(d) if d.abs() > 1.0 => {
            report.warnings.push(format!(
                "انحراف معادلة الميزانية (الأصول ≠ الخصوم + حقوق الملكية + صافي الدخل): {:.2}",
                d
            ));
        }
        Ok(_) => {}
        Err(e) => report.warnings.push(e),
    }

    pool.close().await;
    let _ = std::fs::remove_file(&tmp);

    // Make sure we never mark a newer-than-supported DB as importable.
    if report.ok {
        let inspection = inspect_database_file(path).await?;
        if inspection.newer_than_supported {
            report.errors.push(format!(
                "إصدار قاعدة البيانات ({}) أحدث مما يدعمه التطبيق ({}).",
                inspection.schema_version, inspection.supported_version
            ));
            report.ok = false;
        }
    }

    Ok(report)
}

// ─── Restore ───────────────────────────────────────────────────────────────

/// Copy a standalone SQLite snapshot over the live DB path, deleting any stale
/// WAL/SHM side files. Only call this while NO connections are open.
///
/// The previous DB is retained at `<db>.pre_restore` until post-swap validation
/// passes (see [`rollback_restore`]); the caller decides when to discard it.
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
    let _ = std::fs::remove_file(db_path.with_extension("db.pre_restore"));

    if db_path.exists() {
        std::fs::rename(db_path, db_path.with_extension("db.pre_restore"))
            .map_err(|e| format!("Failed to move current DB aside: {e}"))?;
    }
    std::fs::rename(&tmp, db_path).map_err(|e| format!("Failed to install restored DB: {e}"))?;
    Ok(())
}

/// Roll an applied-but-rejected restore back to the DB state that existed before
/// the swap (`<db>.pre_restore`). The rejected import is preserved at
/// `<db>.rejected` for inspection. Only call while NO connections are open.
///
/// Returns `true` when a rollback actually happened.
pub fn rollback_restore(db_path: &Path) -> Result<bool, String> {
    let old = db_path.with_extension("db.pre_restore");
    if !old.exists() {
        return Ok(false);
    }
    // Preserve the failed import for forensic inspection.
    let rejected = db_path.with_extension("db.rejected");
    let _ = std::fs::remove_file(&rejected);
    if db_path.exists() {
        std::fs::rename(db_path, &rejected)
            .map_err(|e| format!("Failed to preserve rejected DB: {e}"))?;
    }
    let wal = format!("{}-wal", db_path.to_string_lossy());
    let shm = format!("{}-shm", db_path.to_string_lossy());
    let _ = std::fs::remove_file(&wal);
    let _ = std::fs::remove_file(&shm);
    std::fs::rename(&old, db_path).map_err(|e| format!("Failed to restore previous DB: {e}"))?;
    Ok(true)
}

/// Marker file name used to scope a pending restore.
const PENDING_RESTORE_MARKER: &str = "restore.pending.json";

pub fn pending_marker_path(data_dir: &Path) -> PathBuf {
    data_dir.join(PENDING_RESTORE_MARKER)
}

/// Pending-restore marker content (JSON).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

/// Read the pending-restore marker WITHOUT removing it. Deletion is deferred
/// until a restore has been applied AND validated (see [`reconcile_pending_restore`]).
pub fn read_pending_marker(data_dir: &Path) -> Result<Option<PendingRestore>, String> {
    let path = pending_marker_path(data_dir);
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read restore marker: {e}"))?;
    serde_json::from_str(&json)
        .map(Some)
        .map_err(|e| format!("Failed to parse restore marker: {e}"))
}

/// Delete the pending-restore marker file (call only after the restore has been
/// finalized — applied or rolled back).
pub fn remove_pending_marker(data_dir: &Path) -> Result<(), String> {
    let path = pending_marker_path(data_dir);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to remove restore marker: {e}"))?;
    }
    Ok(())
}

/// Result of reconciling pending/interrupted restore state at startup.
#[derive(Debug, Clone, Default)]
pub struct ReconcileResult {
    /// `Some` when a staged restore was applied (or an unfinished one recovered)
    /// and the caller MUST run post-swap validation on the current DB.
    pub pending: Option<PendingRestore>,
    /// `true` when the previous database was recovered without applying anything
    /// (the interrupted swap was rolled back; nothing needs validation).
    pub rolled_back: bool,
}

/// Crash-safe resolution of the on-disk restore state at startup.
///
/// The swap in [`replace_db_file`] involves several renames; a crash between
/// them can leave any combination of `{marker, almowakeb.sqlite, almowakeb.sqlite.pre_restore,
/// almowakeb.sqlite.restore, almowakeb.pending.sqlite}`. This function deterministically turns
/// that state into either a restore that must be validated (roll forward /
/// complete), a recovery of the previous database (roll back), or a clean no-op
/// with stale temp files removed. The marker is intentionally NOT deleted here.
pub fn reconcile_pending_restore(
    data_dir: &Path,
    db_path: &Path,
) -> Result<ReconcileResult, String> {
    let marker = read_pending_marker(data_dir)?;
    let staged = data_dir.join("almowakeb.pending.sqlite");
    let rest = db_path.with_extension("db.restore");
    let pre = db_path.with_extension("db.pre_restore");
    let wal = PathBuf::from(format!("{}-wal", db_path.to_string_lossy()));
    let shm = PathBuf::from(format!("{}-shm", db_path.to_string_lossy()));

    let mut result = ReconcileResult::default();

    if let Some(m) = &marker {
        let staged_from_marker = PathBuf::from(&m.pending_db);
        if !staged_from_marker.exists() {
            // The staged file vanished (deleted/cancelled) — nothing to apply.
            let _ = remove_pending_marker(data_dir);
            let _ = std::fs::remove_file(&rest);
            let _ = std::fs::remove_file(&staged);
            if !db_path.exists() && pre.exists() {
                // Crash after the old DB was moved aside: recover it.
                let _ = std::fs::remove_file(&wal);
                let _ = std::fs::remove_file(&shm);
                std::fs::rename(&pre, db_path)
                    .map_err(|e| format!("Failed to recover previous DB: {e}"))?;
                result.rolled_back = true;
            }
            return Ok(result);
        }

        if !db_path.exists() && pre.exists() && rest.exists() {
            // Crash after `rename(db -> db.pre_restore)` but before
            // `rename(db.restore -> db)`: complete the interrupted swap.
            let _ = std::fs::remove_file(&wal);
            let _ = std::fs::remove_file(&shm);
            std::fs::rename(&rest, db_path)
                .map_err(|e| format!("Failed to complete interrupted swap: {e}"))?;
            result.pending = Some(m.clone());
            return Ok(result);
        }

        if db_path.exists() && pre.exists() {
            // The swap already happened (current DB installed, previous kept
            // aside) but was never finalized — re-validate, then finalize.
            result.pending = Some(m.clone());
        } else {
            // Normal staged-but-not-yet-applied restore (or a crash before the
            // final rename): apply it now. The previous DB is moved to
            // `db.pre_restore` so a failed validation can still roll back.
            replace_db_file(db_path, &staged_from_marker)?;
            result.pending = Some(m.clone());
        }
        // Marker deliberately left in place — the caller removes it only after
        // post-swap validation succeeds (or explicitly on rollback).
    } else if pre.exists() {
        if db_path.exists() {
            // Marker missing but a previous DB is still aside: the restore was
            // applied and will be validated (a crash between install and
            // finalize, or a legacy run that deleted the marker too early).
            result.pending = Some(PendingRestore {
                pending_db: db_path.to_string_lossy().to_string(),
                source_label: "إتمام استعادة سابقة".to_string(),
                created_at: chrono::Local::now().to_rfc3339(),
            });
        } else {
            // Crash after the old DB moved aside with no marker: roll back to it.
            let _ = std::fs::remove_file(&wal);
            let _ = std::fs::remove_file(&shm);
            let _ = std::fs::remove_file(&rest);
            std::fs::rename(&pre, db_path)
                .map_err(|e| format!("Failed to recover previous DB: {e}"))?;
            result.rolled_back = true;
        }
    } else {
        // Nothing pending — sweep stale temp files.
        let _ = std::fs::remove_file(&rest);
        let _ = std::fs::remove_file(&staged);
    }

    Ok(result)
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
            journal_entry_count: None,
            account_count: None,
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
        let keep = retention_keep_set(
            &backups,
            RetentionPolicy {
                daily: 0,
                weekly: 0,
                monthly: 0,
            },
        );
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
        let policy = RetentionPolicy {
            daily: 3,
            weekly: 1,
            monthly: 1,
        };
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

    fn tmp_data_dir(tag: &str) -> PathBuf {
        let base =
            std::env::temp_dir().join(format!("aa_backup_reconcile_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).unwrap();
        base
    }

    fn staged_path(dir: &Path) -> PathBuf {
        dir.join("almowakeb.pending.sqlite")
    }

    fn write_marker(dir: &Path) {
        write_pending_marker(
            dir,
            &PendingRestore {
                pending_db: staged_path(dir).display().to_string(),
                source_label: "test".to_string(),
                created_at: "now".to_string(),
            },
        )
        .unwrap();
    }

    #[test]
    fn reconcile_clean_state_is_noop() {
        let dir = tmp_data_dir("clean");
        let db_path = dir.join("almowakeb.sqlite");
        let r = reconcile_pending_restore(&dir, &db_path).unwrap();
        assert!(r.pending.is_none());
        assert!(!r.rolled_back);
        assert!(!db_path.exists());
    }

    #[test]
    fn reconcile_applies_normal_staged_restore() {
        let dir = tmp_data_dir("apply");
        let db_path = dir.join("almowakeb.sqlite");
        std::fs::write(&db_path, b"old-bytes").unwrap();
        std::fs::write(staged_path(&dir), b"staged-bytes").unwrap();
        write_marker(&dir);
        let r = reconcile_pending_restore(&dir, &db_path).unwrap();
        assert!(r.pending.is_some());
        assert!(!r.rolled_back);
        assert_eq!(std::fs::read(&db_path).unwrap(), b"staged-bytes");
        assert_eq!(
            std::fs::read(db_path.with_extension("db.pre_restore")).unwrap(),
            b"old-bytes"
        );
        // marker kept until post-swap validation finalizes the restore
        assert!(pending_marker_path(&dir).exists());
    }

    #[test]
    fn reconcile_completes_interrupted_swap() {
        // Crash between `db -> db.pre_restore` and `db.restore -> db`.
        let dir = tmp_data_dir("swap");
        let db_path = dir.join("almowakeb.sqlite");
        std::fs::write(staged_path(&dir), b"staged-bytes").unwrap();
        write_marker(&dir);
        std::fs::write(db_path.with_extension("db.pre_restore"), b"old-bytes").unwrap();
        std::fs::write(db_path.with_extension("db.restore"), b"staged-bytes").unwrap();
        let r = reconcile_pending_restore(&dir, &db_path).unwrap();
        assert!(r.pending.is_some());
        assert!(!r.rolled_back);
        assert_eq!(std::fs::read(&db_path).unwrap(), b"staged-bytes");
        assert!(!db_path.with_extension("db.restore").exists());
    }

    #[test]
    fn reconcile_recovers_previous_db_when_staged_missing() {
        // Staged file vanished (cancelled) after the old DB was moved aside.
        let dir = tmp_data_dir("recover");
        let db_path = dir.join("almowakeb.sqlite");
        write_marker(&dir);
        std::fs::write(db_path.with_extension("db.pre_restore"), b"old-bytes").unwrap();
        let r = reconcile_pending_restore(&dir, &db_path).unwrap();
        assert!(r.pending.is_none());
        assert!(r.rolled_back);
        assert_eq!(std::fs::read(&db_path).unwrap(), b"old-bytes");
        assert!(!pending_marker_path(&dir).exists());
    }

    #[test]
    fn reconcile_validates_unfinalized_applied_restore() {
        // Marker gone but db + pre both present: restore was installed but never
        // finalized -> must re-validate, so `pending` is regenerated.
        let dir = tmp_data_dir("unfinalized");
        let db_path = dir.join("almowakeb.sqlite");
        std::fs::write(&db_path, b"new-bytes").unwrap();
        std::fs::write(db_path.with_extension("db.pre_restore"), b"old-bytes").unwrap();
        let r = reconcile_pending_restore(&dir, &db_path).unwrap();
        assert!(r.pending.is_some());
        assert!(!r.rolled_back);
    }

    #[test]
    fn reconcile_rolls_back_orphaned_pre_without_db() {
        // Crash after the old DB moved aside, with no marker: recover it.
        let dir = tmp_data_dir("orphan");
        let db_path = dir.join("almowakeb.sqlite");
        std::fs::write(db_path.with_extension("db.pre_restore"), b"old-bytes").unwrap();
        let r = reconcile_pending_restore(&dir, &db_path).unwrap();
        assert!(r.pending.is_none());
        assert!(r.rolled_back);
        assert_eq!(std::fs::read(&db_path).unwrap(), b"old-bytes");
    }

    #[test]
    fn pre_import_prefix_classifies_by_name_alone() {
        let name = "almowakeb_pre_restore_20260820_093000.sqlite";
        assert!(is_backup_name(name));
        assert_eq!(infer_type(name), "pre_import");
        assert_eq!(label_from_name(name), "20260820_093000");
        // Generic prefixes stay `auto` by name.
        assert_eq!(
            infer_type("almowakeb_backup_20260820_093000.sqlite"),
            "auto"
        );
        assert_eq!(infer_type("erp_backup_20260820_093000.sqlite"), "auto");
    }

    #[test]
    fn retention_never_trims_sidecarless_pre_import() {
        let dir = tmp_data_dir("prekeep");
        let name = "almowakeb_pre_restore_20260820_093000.sqlite";
        std::fs::write(dir.join(name), b"snapshot").unwrap();
        // No sidecar — the name alone must keep it classified `pre_import`.
        let backups = list_backup_files(&dir).unwrap();
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].backup_type, "pre_import");
        // An active policy must not touch it even with no metadata to rely on.
        let policy = RetentionPolicy {
            daily: 1,
            weekly: 0,
            monthly: 0,
        };
        let removed = apply_retention(&dir, policy, &backups).unwrap();
        assert!(
            removed.is_empty(),
            "pre_import snapshot must never be trimmed"
        );
        assert!(dir.join(name).exists());
    }
}
