-- Migration 012: Add is_default column to accounts table
ALTER TABLE accounts ADD COLUMN is_default BOOLEAN DEFAULT 0;

-- Set default accounts for existing seeds
UPDATE accounts SET is_default = 1 WHERE code IN ('120301', '220301');
