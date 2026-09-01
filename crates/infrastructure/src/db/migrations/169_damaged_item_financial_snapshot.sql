-- Canonical damaged-item monetary snapshot.
-- Stores original/base amounts and loss meaning directly on damaged_items so
-- reads, journals, reports and detail views all derive from one source.

ALTER TABLE damaged_items ADD COLUMN currency_code TEXT;
ALTER TABLE damaged_items ADD COLUMN fx_rate TEXT;
ALTER TABLE damaged_items ADD COLUMN cost_impact_base TEXT;
ALTER TABLE damaged_items ADD COLUMN loss TEXT;
ALTER TABLE damaged_items ADD COLUMN loss_base TEXT;
