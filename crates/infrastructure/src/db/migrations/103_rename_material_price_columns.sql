-- Migration 103: Rename material price columns to remove SYP/USD references
-- This is part of the dynamic currency refactoring

-- material_purchase_prices
ALTER TABLE material_purchase_prices RENAME COLUMN price_usd TO price;
ALTER TABLE material_purchase_prices RENAME COLUMN price_syp TO price_base;
ALTER TABLE material_purchase_prices ADD COLUMN currency TEXT NOT NULL DEFAULT '';

-- material_sale_prices
ALTER TABLE material_sale_prices RENAME COLUMN price_usd TO price;
ALTER TABLE material_sale_prices RENAME COLUMN price_syp TO price_base;
ALTER TABLE material_sale_prices RENAME COLUMN min_price_usd TO min_price;
ALTER TABLE material_sale_prices RENAME COLUMN min_price_syp TO min_price_base;
ALTER TABLE material_sale_prices ADD COLUMN currency TEXT NOT NULL DEFAULT '';
