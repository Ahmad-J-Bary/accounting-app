CREATE TABLE material_purchase_prices_new (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES materials(id),
    unit_id TEXT NOT NULL REFERENCES material_units(id),
    price REAL NOT NULL DEFAULT 0,
    price_base REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE(material_id, unit_id, currency)
);

INSERT INTO material_purchase_prices_new (id, material_id, unit_id, price, price_base, currency, updated_at)
SELECT id, material_id, unit_id, price, price_base, currency, updated_at
FROM (
    SELECT
        id,
        material_id,
        unit_id,
        price,
        price_base,
        COALESCE(currency, '') AS currency,
        updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY material_id, unit_id, COALESCE(currency, '')
            ORDER BY updated_at DESC, rowid DESC
        ) AS rn
    FROM material_purchase_prices
)
WHERE rn = 1;

DROP TABLE material_purchase_prices;
ALTER TABLE material_purchase_prices_new RENAME TO material_purchase_prices;

CREATE TABLE material_sale_prices_new (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL REFERENCES materials(id),
    unit_id TEXT NOT NULL REFERENCES material_units(id),
    tier TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    price_base REAL NOT NULL DEFAULT 0,
    min_price REAL NOT NULL DEFAULT 0,
    min_price_base REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    UNIQUE(material_id, unit_id, tier, currency)
);

INSERT INTO material_sale_prices_new (
    id,
    material_id,
    unit_id,
    tier,
    price,
    price_base,
    min_price,
    min_price_base,
    currency,
    updated_at
)
SELECT id, material_id, unit_id, tier, price, price_base, min_price, min_price_base, currency, updated_at
FROM (
    SELECT
        id,
        material_id,
        unit_id,
        tier,
        price,
        price_base,
        min_price,
        min_price_base,
        COALESCE(currency, '') AS currency,
        updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY material_id, unit_id, tier, COALESCE(currency, '')
            ORDER BY updated_at DESC, rowid DESC
        ) AS rn
    FROM material_sale_prices
)
WHERE rn = 1;

DROP TABLE material_sale_prices;
ALTER TABLE material_sale_prices_new RENAME TO material_sale_prices;
