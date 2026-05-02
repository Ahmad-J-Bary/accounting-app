-- Migration 028: Add cost tracking to stock movements
-- Adds unit_cost and total_cost columns to track the value of inventory changes

-- SQLite does not support ALTER TABLE ADD COLUMN with complex defaults or constraints easily in older versions, 
-- but since we are adding TEXT columns with simple defaults, it is supported.

ALTER TABLE stock_movements ADD COLUMN unit_cost TEXT NOT NULL DEFAULT '0';
ALTER TABLE stock_movements ADD COLUMN total_cost TEXT NOT NULL DEFAULT '0';
