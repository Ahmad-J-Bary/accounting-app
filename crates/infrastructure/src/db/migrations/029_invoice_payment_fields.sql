-- Migration 029: Invoice Payment Fields
-- Adds payment_method and amount_paid to unified_invoices

ALTER TABLE unified_invoices ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'Deferred';
ALTER TABLE unified_invoices ADD COLUMN amount_paid TEXT NOT NULL DEFAULT '0';
