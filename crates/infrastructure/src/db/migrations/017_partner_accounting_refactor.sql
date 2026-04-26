-- Migration 017: Refactor Partner Accounting Structure
-- ---------------------------------------------------
-- 1) Convert Capital parent (2202) to Summary/Group
UPDATE accounts 
SET category = 'Summary', is_final = 0, name_ar = 'رأس المال', updated_at = datetime('now')
WHERE code = '222';

-- 2) Convert Withdrawals parent (44) to Summary/Group
UPDATE accounts 
SET category = 'Summary', is_final = 0, name_ar = 'المسحوبات الشخصية', updated_at = datetime('now')
WHERE code = '44';

-- 3) Add drawings_account_id to partners table
ALTER TABLE partners ADD COLUMN drawings_account_id TEXT REFERENCES accounts(id);

-- 4) Cleanup: Re-parent any existing partner accounts mistakenly created under Revenue (3)
-- First, identify accounts under 3 that belong to partners (e.g. name starts with 'رأس مال -')
-- This is heuristic, but helpful for existing data.
UPDATE accounts
SET parent_id = (SELECT id FROM accounts WHERE code = '222'),
    level = 4,
    updated_at = datetime('now')
WHERE parent_id = (SELECT id FROM accounts WHERE code = '3')
  AND (name_ar LIKE 'رأس مال -%' OR name_en LIKE 'Capital -%');

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_partners_drawings_account ON partners(drawings_account_id);
