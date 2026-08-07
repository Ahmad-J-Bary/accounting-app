-- Company Migration / Opening Balance engine.
-- Captures the company's financial position at a cutover date and posts it as
-- a balanced opening journal. Residual (Assets - Liabilities - Capital) is
-- computed and posted to the Opening Balance Equity account (53) for later
-- classification (retained earnings / partner capital).
CREATE TABLE IF NOT EXISTS opening_balance_migrations (
    id TEXT PRIMARY KEY,
    cutover_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',          -- Draft | Posted | Cancelled
    notes TEXT,
    posted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opening_balance_lines (
    id TEXT PRIMARY KEY,
    migration_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    amount TEXT NOT NULL DEFAULT '0',              -- positive magnitude
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (migration_id) REFERENCES opening_balance_migrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_obl_migration ON opening_balance_lines(migration_id);