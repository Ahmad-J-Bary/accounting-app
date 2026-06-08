ALTER TABLE material_sale_prices ADD COLUMN max_quantity TEXT NOT NULL DEFAULT '0';
ALTER TABLE material_sale_prices ADD COLUMN max_quantity_unit_id TEXT;