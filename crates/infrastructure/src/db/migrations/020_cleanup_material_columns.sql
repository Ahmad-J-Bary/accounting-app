-- Migration 020: Cleanup Material Columns
-- Remove legacy columns from the materials table (formerly products)
-- unit_price, cost_price, and stock_quantity are now redundant or handled elsewhere

ALTER TABLE materials DROP COLUMN unit_price;
ALTER TABLE materials DROP COLUMN cost_price;
ALTER TABLE materials DROP COLUMN stock_quantity;
