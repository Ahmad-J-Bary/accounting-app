-- Add new columns to materials
ALTER TABLE materials ADD COLUMN name_en TEXT NOT NULL DEFAULT '';
ALTER TABLE materials ADD COLUMN image_path TEXT;
ALTER TABLE materials ADD COLUMN default_purchase_unit_id TEXT REFERENCES material_units(id);
ALTER TABLE materials ADD COLUMN default_sale_unit_id TEXT REFERENCES material_units(id);

-- Purchase prices per unit
CREATE TABLE material_purchase_prices (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES materials(id),
    unit_id TEXT NOT NULL REFERENCES material_units(id),
    price_usd REAL NOT NULL DEFAULT 0,
    price_syp REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(material_id, unit_id)
);

-- Sale prices per unit per tier
CREATE TABLE material_sale_prices (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES materials(id),
    unit_id TEXT NOT NULL REFERENCES material_units(id),
    tier TEXT NOT NULL, -- 'consumer', 'retail', 'wholesale', 'semi_wholesale', 'special'
    price_usd REAL NOT NULL DEFAULT 0,
    price_syp REAL NOT NULL DEFAULT 0,
    min_price_usd REAL NOT NULL DEFAULT 0,
    min_price_syp REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE(material_id, unit_id, tier)
);
