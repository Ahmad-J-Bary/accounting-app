-- Migration 024: Create category_code_prefixes table for auto-generated material codes

CREATE TABLE IF NOT EXISTS category_code_prefixes (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    next_seq INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Ensure prefix is unique across all categories to avoid collision
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_code_prefixes_prefix ON category_code_prefixes(prefix);
