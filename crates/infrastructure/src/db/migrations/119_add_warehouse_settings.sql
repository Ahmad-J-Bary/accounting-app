ALTER TABLE settings ADD COLUMN purchase_warehouse_id TEXT;
ALTER TABLE settings ADD COLUMN sales_warehouse_id TEXT;
ALTER TABLE unified_invoice_lines ADD COLUMN warehouse_id TEXT;
