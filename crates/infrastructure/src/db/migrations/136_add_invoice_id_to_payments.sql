ALTER TABLE payments ADD COLUMN invoice_id TEXT;
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
