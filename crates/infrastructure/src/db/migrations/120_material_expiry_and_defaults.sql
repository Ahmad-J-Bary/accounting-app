ALTER TABLE materials ADD COLUMN default_purchase_currency TEXT;
ALTER TABLE materials ADD COLUMN default_sale_currency TEXT;
ALTER TABLE materials ADD COLUMN default_warehouse_id TEXT;
ALTER TABLE materials ADD COLUMN has_expiry INTEGER NOT NULL DEFAULT 0;
ALTER TABLE materials ADD COLUMN expiry_alert_before_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE unified_invoice_lines ADD COLUMN expiry_date TEXT;
