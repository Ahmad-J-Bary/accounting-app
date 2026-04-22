-- Migration 005: Syrian Localization
-- Updates default settings and company data for Syria

UPDATE settings 
SET 
    currency = 'SYP',
    currency_symbol = 'ل.س',
    company_name = 'شركة بردى للصناعة',
    updated_at = datetime('now')
WHERE id = 'default';

-- Add currency column to asset_movements if missing
-- (Doing this here just in case as well)
-- ALTER TABLE asset_movements ADD COLUMN currency TEXT NOT NULL DEFAULT 'SYP';
