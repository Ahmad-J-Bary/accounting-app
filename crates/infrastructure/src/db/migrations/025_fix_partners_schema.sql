-- Migration 025: Fix Partners Schema
-- ---------------------------------
-- 1) Create temp table with correct schema
CREATE TABLE partners_new (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    exchange_rate TEXT NOT NULL,
    amount_local TEXT NOT NULL,
    amount_usd TEXT NOT NULL,
    is_amount_in_usd BOOLEAN NOT NULL DEFAULT 0,
    profit_sharing_ratio TEXT,
    profit_sharing_type TEXT NOT NULL,
    linked_account_id TEXT,
    drawings_account_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_account_id) REFERENCES accounts(id),
    FOREIGN KEY (drawings_account_id) REFERENCES accounts(id)
);

-- 2) Copy data if exists (handling id cast)
-- Use a subquery to avoid error if table doesn't exist (though it should)
INSERT INTO partners_new (id, code, name, exchange_rate, amount_local, amount_usd, is_amount_in_usd, profit_sharing_ratio, profit_sharing_type, linked_account_id, drawings_account_id, created_at, updated_at)
SELECT CAST(id AS TEXT), 'P' || id, name, exchange_rate, amount_local, amount_usd, is_amount_in_usd, profit_sharing_ratio, profit_sharing_type, linked_account_id, drawings_account_id, created_at, updated_at FROM partners;

-- 3) Drop old table and rename new one
DROP TABLE partners;
ALTER TABLE partners_new RENAME TO partners;

-- 4) Re-create indexes
CREATE INDEX idx_partners_linked_account ON partners(linked_account_id);
CREATE INDEX idx_partners_drawings_account ON partners(drawings_account_id);
