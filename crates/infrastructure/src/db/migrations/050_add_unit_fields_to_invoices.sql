-- Add unit_id and conversion_factor to unified_invoice_lines
ALTER TABLE unified_invoice_lines ADD COLUMN unit_id TEXT;
ALTER TABLE unified_invoice_lines ADD COLUMN conversion_factor TEXT;

-- Add unit_id and conversion_factor to purchase_invoice_items (legacy)
ALTER TABLE purchase_invoice_items ADD COLUMN unit_id TEXT;
ALTER TABLE purchase_invoice_items ADD COLUMN conversion_factor TEXT;
