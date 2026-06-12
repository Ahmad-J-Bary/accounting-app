-- Migration 121: Add signed_quantity to stock_movements for adjustment direction
-- Add unit_cost and notes to stock_adjustments

ALTER TABLE stock_movements ADD COLUMN signed_quantity TEXT;

ALTER TABLE stock_adjustments ADD COLUMN unit_cost TEXT NOT NULL DEFAULT '0';
ALTER TABLE stock_adjustments ADD COLUMN notes TEXT;
