-- Migration 039: Enhance payments table to work as accounting vouchers
-- Adds voucher metadata and direct link to generated journal entry number.

ALTER TABLE payments ADD COLUMN voucher_number TEXT;
ALTER TABLE payments ADD COLUMN currency_code TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN exchange_rate TEXT NOT NULL DEFAULT '1';
ALTER TABLE payments ADD COLUMN debit_account_id TEXT;
ALTER TABLE payments ADD COLUMN credit_account_id TEXT;
ALTER TABLE payments ADD COLUMN journal_entry_number TEXT;

UPDATE payments
SET voucher_number = COALESCE(voucher_number, id)
WHERE voucher_number IS NULL OR voucher_number = '';

CREATE INDEX IF NOT EXISTS idx_payments_voucher_number ON payments(voucher_number);
CREATE INDEX IF NOT EXISTS idx_payments_type_date ON payments(payment_type, payment_date);
