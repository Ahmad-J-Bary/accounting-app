-- Migration 018: Material Card and Categories
-- Renames products to materials and adds hierarchical categories with many-to-many relationship

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- 2. Rename products to materials
-- Note: SQLite ALTER TABLE RENAME TO handles updating foreign keys in other tables automatically in newer versions
ALTER TABLE products RENAME TO materials;

-- 3. Add notes to materials
ALTER TABLE materials ADD COLUMN notes TEXT;

-- 4. Create material_categories join table (Many-to-Many)
CREATE TABLE IF NOT EXISTS material_categories (
    material_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    PRIMARY KEY (material_id, category_id),
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 5. Seed default "General" category
INSERT INTO categories (id, name, parent_id, is_active, created_at, updated_at)
VALUES ('cat-general-default', 'عام', NULL, 1, datetime('now'), datetime('now'));

-- 6. Link existing materials to the "General" category
INSERT INTO material_categories (material_id, category_id)
SELECT id, 'cat-general-default' FROM materials;
