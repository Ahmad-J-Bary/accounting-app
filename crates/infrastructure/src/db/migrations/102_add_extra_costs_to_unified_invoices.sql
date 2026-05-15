ALTER TABLE unified_invoices ADD COLUMN extra_costs TEXT NOT NULL DEFAULT '0';
ALTER TABLE unified_invoices ADD COLUMN extra_costs_base TEXT NOT NULL DEFAULT '0';
