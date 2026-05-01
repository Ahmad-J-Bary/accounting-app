-- Migration 027: Material Multi Units
-- Implements multiple units of measurement per material

-- 1. Create material_units table
CREATE TABLE IF NOT EXISTS material_units (
    id TEXT PRIMARY KEY,
    material_id TEXT NOT NULL,
    name TEXT NOT NULL,
    conversion_factor TEXT NOT NULL,
    barcode TEXT,
    is_base BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);
