-- Migration 023: Add is_hybrid to categories + rename default from 'عام' to 'غير مصنف'

-- 1. Add is_hybrid column (default false)
ALTER TABLE categories ADD COLUMN is_hybrid BOOLEAN NOT NULL DEFAULT 0;

-- 2. Rename the default category from 'عام' to 'غير مصنف'
UPDATE categories
SET name = 'غير مصنف', updated_at = datetime('now')
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 3. Create code_prefix column for categories (used by auto-code generation)
ALTER TABLE categories ADD COLUMN code_prefix TEXT;

-- 4. Create sequence tracker for auto-codes per category
CREATE TABLE IF NOT EXISTS category_code_sequences (
    category_id TEXT PRIMARY KEY,
    next_seq    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
