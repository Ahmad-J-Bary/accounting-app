CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE stock_movements ADD COLUMN warehouse_id TEXT;

-- The default warehouse is created dynamically by ensureDefaultWarehouse()
-- with the name "مستودع ${company_name}" based on company settings
