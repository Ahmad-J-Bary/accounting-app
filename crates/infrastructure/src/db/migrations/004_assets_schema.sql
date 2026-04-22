-- Assets & Consumables Schema

CREATE TABLE IF NOT EXISTS asset_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL -- 'Fixed' or 'Consumable'
);

CREATE TABLE IF NOT EXISTS fixed_assets (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    purchase_cost TEXT NOT NULL, -- Money amount
    currency TEXT NOT NULL,
    fx_rate TEXT NOT NULL,
    useful_life_months INTEGER NOT NULL,
    salvage_value TEXT,
    accumulated_depreciation TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL, -- 'Active', 'Disposed', 'Sold', 'Damaged'
    location TEXT,
    notes TEXT,
    asset_account_id TEXT NOT NULL,
    depreciation_account_id TEXT NOT NULL,
    accumulated_depreciation_account_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES asset_categories(id)
);

CREATE TABLE IF NOT EXISTS consumables (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    quantity_on_hand TEXT NOT NULL DEFAULT '0',
    unit_cost TEXT NOT NULL,
    currency TEXT NOT NULL,
    fx_rate TEXT NOT NULL,
    status TEXT NOT NULL, -- 'InStock', 'Exhausted', 'Damaged'
    location TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES asset_categories(id)
);

CREATE TABLE IF NOT EXISTS asset_movements (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    movement_type TEXT NOT NULL, -- 'Acquisition', 'Depreciation', 'Disposal', 'Sale', 'Adjustment', 'Consumption'
    movement_date TEXT NOT NULL,
    quantity TEXT,
    amount TEXT NOT NULL,
    description TEXT,
    reference_no TEXT,
    journal_entry_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS depreciation_schedules (
    id TEXT PRIMARY KEY,
    fixed_asset_id TEXT NOT NULL,
    period_date TEXT NOT NULL,
    depreciation_amount TEXT NOT NULL,
    accumulated_depreciation TEXT NOT NULL,
    remaining_value TEXT NOT NULL,
    status TEXT NOT NULL, -- 'Pending', 'Posted'
    journal_entry_id TEXT,
    FOREIGN KEY (fixed_asset_id) REFERENCES fixed_assets(id)
);
