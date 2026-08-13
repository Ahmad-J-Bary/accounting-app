-- Phase 2 — Unified Company Accounting Model (ONE accounting system).
-- Replaces the parallel free-text sub-ledger tables (Opening Customer / Opening
-- Supplier / Opening Inventory / Opening Asset) with a single link table whose
-- rows reference REAL entities. Existing vs New company now differ only by the
-- opening context: each real entity carries an opening amount inside the
-- migration (Customer + Opening Balance Movement), never an "Opening Customer".

CREATE TABLE IF NOT EXISTS opening_migration_items (
    id TEXT PRIMARY KEY,
    migration_id TEXT NOT NULL,
    kind TEXT NOT NULL,                -- AR | AP | Inventory | FixedAsset
    entity_id TEXT NOT NULL,           -- real customer/supplier/material/asset id
    reference TEXT,
    amount TEXT NOT NULL DEFAULT '0',  -- balance (AR/AP net, inventory total cost, FA net book value)
    qty TEXT NOT NULL DEFAULT '1',
    created_at TEXT NOT NULL,
    FOREIGN KEY (migration_id) REFERENCES opening_balance_migrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_obmi_migration ON opening_migration_items(migration_id);

-- The free-text detail stores are superseded by the real-entity link table.
DROP TABLE IF EXISTS opening_balance_customer_items;
DROP TABLE IF EXISTS opening_balance_supplier_items;
DROP TABLE IF EXISTS opening_balance_inventory_items;
DROP TABLE IF EXISTS opening_balance_fixed_assets;