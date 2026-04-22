-- Migration 006: Simplified Products
-- Adds barcode and multiple price tiers to products table

ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN purchase_price TEXT;
ALTER TABLE products ADD COLUMN retail_price TEXT;
ALTER TABLE products ADD COLUMN wholesale_price TEXT;
ALTER TABLE products ADD COLUMN semi_wholesale_price TEXT;

-- Migrate existing data
UPDATE products SET retail_price = unit_price;
UPDATE products SET purchase_price = cost_price;

-- Note: We keep unit_price and cost_price for now to avoid breaking existing queries 
-- until we update all code references. In a future migration we can drop them.
