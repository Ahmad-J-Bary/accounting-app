CREATE TABLE warehouses_new (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

INSERT INTO warehouses_new (id, name, address, is_active, is_default, created_at, updated_at)
SELECT id, name, address, is_active, is_default, created_at, updated_at FROM warehouses;

DROP TABLE warehouses;

ALTER TABLE warehouses_new RENAME TO warehouses;
