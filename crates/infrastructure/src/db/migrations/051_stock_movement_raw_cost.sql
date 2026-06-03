-- Add raw_total_cost_base column to stock_movements for computing average raw price (without extras)
ALTER TABLE stock_movements ADD COLUMN raw_total_cost_base TEXT NOT NULL DEFAULT '0';
