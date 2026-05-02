-- Migration 030: Add customer/supplier name to unified invoices
ALTER TABLE unified_invoices ADD COLUMN customer_name TEXT;
ALTER TABLE unified_invoices ADD COLUMN supplier_name TEXT;
