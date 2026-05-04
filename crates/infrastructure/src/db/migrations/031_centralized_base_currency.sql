-- Migration 030: Centralized Base Currency Support
-- Adds base_amount and original_amount tracking to financial tables

-- Unified Invoices: Track base amount equivalent
ALTER TABLE unified_invoices ADD COLUMN total_amount_base TEXT NOT NULL DEFAULT '0';
ALTER TABLE unified_invoices ADD COLUMN amount_paid_base TEXT NOT NULL DEFAULT '0';
ALTER TABLE unified_invoices ADD COLUMN tax_amount_base TEXT NOT NULL DEFAULT '0';
ALTER TABLE unified_invoices ADD COLUMN discount_amount_base TEXT NOT NULL DEFAULT '0';

-- Journal Lines: Consolidate to original/base amounts
ALTER TABLE journal_lines ADD COLUMN debit_base TEXT NOT NULL DEFAULT '0';
ALTER TABLE journal_lines ADD COLUMN credit_base TEXT NOT NULL DEFAULT '0';

-- Stock Movements: Ensure cost is stored in base currency
ALTER TABLE stock_movements ADD COLUMN unit_cost_base TEXT NOT NULL DEFAULT '0';
ALTER TABLE stock_movements ADD COLUMN total_cost_base TEXT NOT NULL DEFAULT '0';
ALTER TABLE stock_movements ADD COLUMN original_currency TEXT;
ALTER TABLE stock_movements ADD COLUMN fx_rate TEXT NOT NULL DEFAULT '1';
