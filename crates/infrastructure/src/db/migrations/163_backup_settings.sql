-- Backup / restore settings and DB metadata key-value store.
-- Used by the backup system (retention, location, last auto-backup) so that
-- user preferences survive across restarts without a separate config file.
CREATE TABLE IF NOT EXISTS app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);