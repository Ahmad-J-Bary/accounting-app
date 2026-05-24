-- Migration 104: Rename USD columns to use 'original' instead
-- This is part of the dynamic currency refactoring

-- partners table
ALTER TABLE partners RENAME COLUMN amount_usd TO amount_original;
ALTER TABLE partners RENAME COLUMN is_amount_in_usd TO is_amount_in_original;

-- unified_invoice_lines table
ALTER TABLE unified_invoice_lines RENAME COLUMN unit_price_usd TO unit_price_original;
ALTER TABLE unified_invoice_lines RENAME COLUMN purchase_price_usd TO purchase_price_original;
ALTER TABLE unified_invoice_lines RENAME COLUMN profit_amount_usd TO profit_amount_original;

-- Update profit_sharing_type values
UPDATE partners SET profit_sharing_type = 'BasedOnCapitalOriginal' WHERE profit_sharing_type = 'BasedOnCapitalUSD';
