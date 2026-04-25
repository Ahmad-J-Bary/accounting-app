-- Migration 015: Fix account numbering (1 digit per level) and mark final leaf accounts
-- -------------------------------------------------------------------------------
-- Goals:
-- 1) Fix account codes to have exactly 1 digit per level (level 1=1 digit, level 2=2 digits, etc.)
-- 2) Add is_final column to mark leaf accounts that cannot have children
-- 3) Set specific final leaf codes: زبون نقدي = 1231, مورد نقدي = 2231
-- 4) Re-parent accounts to match new numbering structure

-- Add is_final column if not exists (for marking leaf/final accounts)
ALTER TABLE accounts ADD COLUMN is_final BOOLEAN DEFAULT 0;

-- =========================
-- A) Fix Level 3 accounts (should be 3 digits: 111, 112, 121, 122, 123, etc.)
-- =========================

-- Assets Level 3 (under 11 = Fixed Assets)
UPDATE accounts SET code = '111', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '11'), updated_at = datetime('now') WHERE code = '1101';
UPDATE accounts SET code = '112', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '11'), updated_at = datetime('now') WHERE code = '1102';
UPDATE accounts SET code = '113', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '11'), updated_at = datetime('now') WHERE code = '1103';

-- Assets Level 3 (under 12 = Current Assets)
UPDATE accounts SET code = '121', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '12'), updated_at = datetime('now') WHERE code = '1201';
UPDATE accounts SET code = '122', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '12'), updated_at = datetime('now') WHERE code = '1202';
UPDATE accounts SET code = '123', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '12'), category = 'Summary', updated_at = datetime('now') WHERE code = '1203';
UPDATE accounts SET code = '124', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '12'), category = 'Summary', updated_at = datetime('now') WHERE code = '1204';

-- Liabilities Level 3 (under 22 = Current Liabilities)
UPDATE accounts SET code = '221', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '22'), updated_at = datetime('now') WHERE code = '2201';
UPDATE accounts SET code = '222', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '22'), updated_at = datetime('now') WHERE code = '2202';
UPDATE accounts SET code = '223', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '22'), category = 'Summary', updated_at = datetime('now') WHERE code = '2203';

-- Revenue Level 3 (under 31 = Sales)
UPDATE accounts SET code = '311', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '31'), updated_at = datetime('now') WHERE code = '3101';
UPDATE accounts SET code = '312', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '31'), updated_at = datetime('now') WHERE code = '3102';

-- Expenses Level 3 (under 43 = Other Expenses)
UPDATE accounts SET code = '431', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '43'), updated_at = datetime('now') WHERE code = '4301';
UPDATE accounts SET code = '432', level = 3, parent_id = (SELECT id FROM accounts WHERE code = '43'), updated_at = datetime('now') WHERE code = '4302';

-- =========================
-- B) Fix Level 4 accounts (should be 4 digits: 1231, 1232, 2231, etc.)
-- =========================

-- Assets Level 4 (under 123 = Accounts Receivable)
-- زبون نقدي = 1231 (FINAL LEAF - cannot have children)
UPDATE accounts SET 
    code = '1231', 
    level = 4, 
    parent_id = (SELECT id FROM accounts WHERE code = '123'),
    category = 'Detail',
    is_final = 1,
    updated_at = datetime('now') 
WHERE code = '120301' OR name_ar = 'زبون نقدي';

-- Assets Level 4 (under 124 = Inventory)
-- بضاعة آخر المدة = 1241 (FINAL LEAF)
UPDATE accounts SET 
    code = '1241', 
    level = 4, 
    parent_id = (SELECT id FROM accounts WHERE code = '124'),
    category = 'Detail',
    is_final = 1,
    updated_at = datetime('now') 
WHERE code = '120401';

-- Liabilities Level 4 (under 223 = Accounts Payable)
-- مورد نقدي = 2231 (FINAL LEAF - cannot have children)
UPDATE accounts SET 
    code = '2231', 
    level = 4, 
    parent_id = (SELECT id FROM accounts WHERE code = '223'),
    category = 'Detail',
    is_final = 1,
    updated_at = datetime('now') 
WHERE code = '220301' OR name_ar = 'مورد نقدي';

-- =========================
-- C) Mark all other leaf accounts as final (accounts with no children)
-- =========================
UPDATE accounts SET is_final = 1 
WHERE NOT EXISTS (
    SELECT 1 FROM accounts child WHERE child.parent_id = accounts.id
) AND (is_final IS NULL OR is_final = 0);

-- =========================
-- D) Ensure summary accounts are NOT final (can have children)
-- =========================
UPDATE accounts SET is_final = 0, category = 'Summary' 
WHERE EXISTS (
    SELECT 1 FROM accounts child WHERE child.parent_id = accounts.id
);

-- =========================
-- E) Verify and normalize root accounts (level 1)
-- =========================
UPDATE accounts SET parent_id = NULL, level = 1, category = 'Summary', is_final = 0 WHERE code = '1';
UPDATE accounts SET parent_id = NULL, level = 1, category = 'Summary', is_final = 0 WHERE code = '2';
UPDATE accounts SET parent_id = NULL, level = 1, category = 'Summary', is_final = 0 WHERE code = '3';
UPDATE accounts SET parent_id = NULL, level = 1, category = 'Summary', is_final = 0 WHERE code = '4';

-- =========================
-- F) Verify and normalize level 2 accounts
-- =========================
UPDATE accounts SET level = 2, category = 'Summary', is_final = 0 WHERE code IN ('11', '12', '21', '22', '31', '32', '33', '41', '42', '43', '44');
