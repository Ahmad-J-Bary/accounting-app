-- Opening Balance Migration: full state machine + sub-ledger detail tables.
-- Forward-only; does not touch existing 139 DDL.

ALTER TABLE opening_balance_migrations ADD COLUMN company_id TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN source_system TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN source_reference TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN validated_by TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN validated_at TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN approved_by TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN approved_at TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN locked_at TEXT;

CREATE TABLE IF NOT EXISTS opening_balance_customer_items (
    id TEXT PRIMARY KEY,
    migration_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    reference TEXT,
    original_amount TEXT NOT NULL DEFAULT '0',
    outstanding_amount TEXT NOT NULL DEFAULT '0',
    due_date TEXT,
    currency_code TEXT,
    exchange_rate TEXT NOT NULL DEFAULT '1',
    created_at TEXT NOT NULL,
    FOREIGN KEY (migration_id) REFERENCES opening_balance_migrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS opening_balance_supplier_items (
    id TEXT PRIMARY KEY,
    migration_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    reference TEXT,
    original_amount TEXT NOT NULL DEFAULT '0',
    outstanding_amount TEXT NOT NULL DEFAULT '0',
    due_date TEXT,
    currency_code TEXT,
    exchange_rate TEXT NOT NULL DEFAULT '1',
    created_at TEXT NOT NULL,
    FOREIGN KEY (migration_id) REFERENCES opening_balance_migrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS opening_balance_inventory_items (
    id TEXT PRIMARY KEY,
    migration_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    warehouse_id TEXT,
    quantity TEXT NOT NULL DEFAULT '0',
    unit_cost TEXT NOT NULL DEFAULT '0',
    total_cost TEXT NOT NULL DEFAULT '0',
    batch TEXT,
    currency_code TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (migration_id) REFERENCES opening_balance_migrations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS opening_balance_fixed_assets (
    id TEXT PRIMARY KEY,
    migration_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    acquisition_cost TEXT NOT NULL DEFAULT '0',
    accumulated_depreciation TEXT NOT NULL DEFAULT '0',
    net_book_value TEXT NOT NULL DEFAULT '0',
    acquisition_date TEXT,
    depreciation_method TEXT,
    useful_life TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (migration_id) REFERENCES opening_balance_migrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_obc_migration ON opening_balance_customer_items(migration_id);
CREATE INDEX IF NOT EXISTS idx_obs_migration ON opening_balance_supplier_items(migration_id);
CREATE INDEX IF NOT EXISTS idx_obi_migration ON opening_balance_inventory_items(migration_id);
CREATE INDEX IF NOT EXISTS idx_obfa_migration ON opening_balance_fixed_assets(migration_id);