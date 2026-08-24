-- Migration 164: Add automotive/fixed asset category (code 112) and renumber
-- -----------------------------------------------------------------------------
-- Self-contained: handles all DB states (fresh, legacy 110x, post-015, partial).
-- Parent account "11" is ensured before any child operations.

-- 0) Ensure parent "11 - الأصول الثابتة" exists (deterministic ID from migration 011)
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000011', '11', 'الأصول الثابتة', 'Fixed Assets', 'Assets',
 (SELECT id FROM accounts WHERE code = '1'), 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now'));

-- 1) أثاث: any existing code → 114 (furthest first to avoid UNIQUE conflicts)
UPDATE accounts SET code = '114', updated_at = datetime('now')
WHERE code IN ('1103', '113') AND code != '114';

-- 2) معدات: any existing code → temporary (avoid clash with the new 112)
UPDATE accounts SET code = '112_tmp', updated_at = datetime('now')
WHERE code IN ('1102', '112') AND code != '112_tmp';

-- 3) Insert آليات at code 112 (idempotent with deterministic ID)
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000112', '112', 'آليات', 'Automotive & Machinery', 'Assets',
 (SELECT id FROM accounts WHERE code = '11'), 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now'));

-- 4) معدات: temporary → 113 (new position)
UPDATE accounts SET code = '113', updated_at = datetime('now') WHERE code = '112_tmp';

-- 5) أبنية: any legacy code → 111
UPDATE accounts SET code = '111', updated_at = datetime('now')
WHERE code = '1101' AND code != '111';

-- 6) Ensure all child accounts point to parent "11"
UPDATE accounts SET parent_id = (SELECT id FROM accounts WHERE code = '11'), updated_at = datetime('now')
WHERE code IN ('111', '112', '113', '114')
AND parent_id != (SELECT id FROM accounts WHERE code = '11');
