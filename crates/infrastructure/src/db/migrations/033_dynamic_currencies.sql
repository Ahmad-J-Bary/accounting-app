-- Migration 032: Dynamic Currencies and Exchange Rates

-- 1. Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
    code TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 2,
    is_base BOOLEAN NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create exchange_rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate TEXT NOT NULL, -- Decimal as String
    rate_type TEXT NOT NULL, -- Purchase, Sale, Middle, etc.
    rate_date DATETIME NOT NULL,
    source TEXT, -- Manual, API, etc.
    user_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_currency) REFERENCES currencies(code),
    FOREIGN KEY (to_currency) REFERENCES currencies(code)
);

-- 3. No default currencies — user adds them from settings
-- 4. Update settings table to reference dynamic currency
ALTER TABLE settings ADD COLUMN base_currency_code TEXT DEFAULT '';

-- 5. Add multi-currency fields to unified_invoices
ALTER TABLE unified_invoices ADD COLUMN currency_code TEXT NOT NULL DEFAULT '';
ALTER TABLE unified_invoices ADD COLUMN exchange_rate TEXT NOT NULL DEFAULT '1.0';

-- 6. Add multi-currency fields to journal_entries
ALTER TABLE journal_entries ADD COLUMN currency_code TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_entries ADD COLUMN exchange_rate TEXT NOT NULL DEFAULT '1.0';
