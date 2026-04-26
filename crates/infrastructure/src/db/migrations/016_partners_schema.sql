-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    exchange_rate TEXT NOT NULL,
    amount_local TEXT NOT NULL,
    amount_usd TEXT NOT NULL,
    is_amount_in_usd BOOLEAN NOT NULL DEFAULT 0,
    profit_sharing_ratio TEXT,
    profit_sharing_type TEXT NOT NULL,
    linked_account_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_account_id) REFERENCES accounts(id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_partners_linked_account ON partners(linked_account_id);
