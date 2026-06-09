ALTER TABLE material_sale_prices ADD COLUMN min_quantity TEXT NOT NULL DEFAULT '0';
ALTER TABLE material_sale_prices ADD COLUMN min_quantity_unit_id TEXT;