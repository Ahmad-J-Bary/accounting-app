-- Migration 012: Normalize COA hierarchy and safely clean deprecated legacy accounts
-- -------------------------------------------------------------------------------
-- Goals:
-- 1) Enforce the requested Arabic hierarchical Chart of Accounts structure.
-- 2) Keep migration idempotent and safe for existing installations.
-- 3) Avoid FK breakage by:
--    - Resolving parent_id through code lookups.
--    - Deleting legacy accounts only if not referenced by journal_lines.
-- 4) Preserve migration stability by keeping prior migrations immutable.

-- Ensure expected columns exist in accounts (defensive for older DB states).
-- NOTE: If a column already exists, SQLite will error on ADD COLUMN.
-- This migration assumes prior migrations were applied (010+), as in normal flow.

-- =========================
-- A) Ensure required accounts exist (INSERT OR IGNORE)
-- =========================

-- Roots
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000001', '1', 'الأصول', 'Assets', 'Assets', NULL, 'Summary', 1, '0', '0', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000002', '2', 'الخصوم', 'Liabilities', 'Liabilities', NULL, 'Summary', 1, '0', '0', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000003', '3', 'الإيرادات', 'Revenue', 'Revenue', NULL, 'Summary', 1, '0', '0', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES
('00000000-0000-0000-0000-000000000004', '4', 'المصروفات', 'Expenses', 'Expenses', NULL, 'Summary', 1, '0', '0', 1, datetime('now'), datetime('now'));

-- Assets branch
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000011', '11', 'الأصول الثابتة', 'Fixed Assets', 'Assets', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '1';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001101', '1101', 'أبنية وأراضي', 'Buildings & Land', 'Assets', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '11';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001102', '1102', 'معدات وتجهيزات', 'Equipment', 'Assets', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '11';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001103', '1103', 'أثاث ومفروشات', 'Furniture', 'Assets', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '11';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000012', '12', 'الأصول المتداولة', 'Current Assets', 'Assets', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '1';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001201', '1201', 'بضاعة أول المدة', 'Opening Stock', 'Assets', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '12';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001202', '1202', 'الصندوق (الخزينة)', 'Cash', 'Assets', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '12';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001230', '1203', 'المدينون (العملاء والزبائن)', 'Accounts Receivable', 'Assets', p.id, 'Summary', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '12';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000120301', '120301', 'زبون نقدي', 'Cash Customer', 'Assets', p.id, 'Detail', 4, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '1203';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001204', '1204', 'المخزون', 'Inventory', 'Assets', p.id, 'Summary', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '12';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000120401', '120401', 'بضاعة آخر المدة', 'Closing Stock', 'Assets', p.id, 'Detail', 4, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '1204';

-- Liabilities branch
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000021', '21', 'الخصوم الثابتة', 'Fixed Liabilities', 'Liabilities', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '2';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000022', '22', 'الخصوم المتداولة', 'Current Liabilities', 'Liabilities', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '2';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000002201', '2201', 'تكاليف إضافية على المشتريات', 'Additional Purchase Costs', 'Liabilities', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '22';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000002202', '2202', 'رأس المال', 'Capital', 'Equity', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '22';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000002230', '2203', 'الدائنون (الموردون)', 'Accounts Payable', 'Liabilities', p.id, 'Summary', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '22';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000220301', '220301', 'مورد نقدي', 'Cash Supplier', 'Liabilities', p.id, 'Detail', 4, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '2203';

-- Revenue branch
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000031', '31', 'المبيعات', 'Sales', 'Revenue', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '3';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000003101', '3101', 'المبيعات النقدية', 'Cash Sales', 'Revenue', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '31';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000003102', '3102', 'المبيعات الآجلة', 'Credit Sales', 'Revenue', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '31';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000032', '32', 'مرتجع المشتريات', 'Purchase Returns', 'Revenue', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '3';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000033', '33', 'إيرادات أخرى', 'Other Revenue', 'Revenue', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '3';

-- Expenses branch
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000041', '41', 'المشتريات', 'Purchases', 'Expenses', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000042', '42', 'مرتجع المبيعات', 'Sales Returns', 'Expenses', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000043', '43', 'مصاريف أخرى', 'Other Expenses', 'Expenses', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000004301', '4301', 'مصاريف الرواتب', 'Salaries Expenses', 'Expenses', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '43';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000004302', '4302', 'مصاريف الإيجارات', 'Rent Expenses', 'Expenses', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '43';

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000044', '44', 'مسحوبات', 'Withdrawals', 'Expenses', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';

-- =========================
-- B) Normalize hierarchy + labels + parent links
-- =========================

-- Roots
UPDATE accounts
SET name_ar = 'الأصول', name_en = 'Assets', account_type = 'Assets', category = 'Summary', level = 1, parent_id = NULL, is_active = 1, updated_at = datetime('now')
WHERE code = '1';

UPDATE accounts
SET name_ar = 'الخصوم', name_en = 'Liabilities', account_type = 'Liabilities', category = 'Summary', level = 1, parent_id = NULL, is_active = 1, updated_at = datetime('now')
WHERE code = '2';

UPDATE accounts
SET name_ar = 'الإيرادات', name_en = 'Revenue', account_type = 'Revenue', category = 'Summary', level = 1, parent_id = NULL, is_active = 1, updated_at = datetime('now')
WHERE code = '3';

UPDATE accounts
SET name_ar = 'المصروفات', name_en = 'Expenses', account_type = 'Expenses', category = 'Summary', level = 1, parent_id = NULL, is_active = 1, updated_at = datetime('now')
WHERE code = '4';

-- Assets
UPDATE accounts
SET name_ar = 'الأصول الثابتة', name_en = 'Fixed Assets', account_type = 'Assets', category = 'Summary', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '1'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '11';

UPDATE accounts
SET name_ar = 'أبنية وأراضي', name_en = 'Buildings & Land', account_type = 'Assets', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '11'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '1101';

UPDATE accounts
SET name_ar = 'معدات وتجهيزات', name_en = 'Equipment', account_type = 'Assets', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '11'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '1102';

UPDATE accounts
SET name_ar = 'أثاث ومفروشات', name_en = 'Furniture', account_type = 'Assets', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '11'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '1103';

UPDATE accounts
SET name_ar = 'الأصول المتداولة', name_en = 'Current Assets', account_type = 'Assets', category = 'Summary', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '1'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '12';

UPDATE accounts
SET name_ar = 'بضاعة أول المدة', name_en = 'Opening Stock', account_type = 'Assets', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '12'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '1201';

UPDATE accounts
SET name_ar = 'الصندوق (الخزينة)', name_en = 'Cash', account_type = 'Assets', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '12'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '1202';

UPDATE accounts
SET name_ar = 'المدينون (العملاء والزبائن)', name_en = 'Accounts Receivable', account_type = 'Assets', category = 'Summary', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '12'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '1203';

UPDATE accounts
SET name_ar = 'زبون نقدي', name_en = 'Cash Customer', account_type = 'Assets', category = 'Detail', level = 4,
    parent_id = (SELECT id FROM accounts WHERE code = '1203'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '120301';

UPDATE accounts
SET name_ar = 'المخزون', name_en = 'Inventory', account_type = 'Assets', category = 'Summary', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '12'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '1204';

UPDATE accounts
SET name_ar = 'بضاعة آخر المدة', name_en = 'Closing Stock', account_type = 'Assets', category = 'Detail', level = 4,
    parent_id = (SELECT id FROM accounts WHERE code = '1204'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '120401';

-- Liabilities
UPDATE accounts
SET name_ar = 'الخصوم الثابتة', name_en = 'Fixed Liabilities', account_type = 'Liabilities', category = 'Summary', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '2'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '21';

UPDATE accounts
SET name_ar = 'الخصوم المتداولة', name_en = 'Current Liabilities', account_type = 'Liabilities', category = 'Summary', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '2'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '22';

UPDATE accounts
SET name_ar = 'تكاليف إضافية على المشتريات', name_en = 'Additional Purchase Costs', account_type = 'Liabilities', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '22'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '2201';

UPDATE accounts
SET name_ar = 'رأس المال', name_en = 'Capital', account_type = 'Equity', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '22'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '2202';

UPDATE accounts
SET name_ar = 'الدائنون (الموردون)', name_en = 'Accounts Payable', account_type = 'Liabilities', category = 'Summary', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '22'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '2203';

UPDATE accounts
SET name_ar = 'مورد نقدي', name_en = 'Cash Supplier', account_type = 'Liabilities', category = 'Detail', level = 4,
    parent_id = (SELECT id FROM accounts WHERE code = '2203'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '220301';

-- Revenue
UPDATE accounts
SET name_ar = 'المبيعات', name_en = 'Sales', account_type = 'Revenue', category = 'Summary', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '3'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '31';

UPDATE accounts
SET name_ar = 'المبيعات النقدية', name_en = 'Cash Sales', account_type = 'Revenue', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '31'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '3101';

UPDATE accounts
SET name_ar = 'المبيعات الآجلة', name_en = 'Credit Sales', account_type = 'Revenue', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '31'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '3102';

UPDATE accounts
SET name_ar = 'مرتجع المشتريات', name_en = 'Purchase Returns', account_type = 'Revenue', category = 'Detail', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '3'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '32';

UPDATE accounts
SET name_ar = 'إيرادات أخرى', name_en = 'Other Revenue', account_type = 'Revenue', category = 'Summary', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '3'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '33';

-- Expenses
UPDATE accounts
SET name_ar = 'المشتريات', name_en = 'Purchases', account_type = 'Expenses', category = 'Detail', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '4'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '41';

UPDATE accounts
SET name_ar = 'مرتجع المبيعات', name_en = 'Sales Returns', account_type = 'Expenses', category = 'Detail', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '4'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '42';

UPDATE accounts
SET name_ar = 'مصاريف أخرى', name_en = 'Other Expenses', account_type = 'Expenses', category = 'Summary', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '4'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '43';

UPDATE accounts
SET name_ar = 'مصاريف الرواتب', name_en = 'Salaries Expenses', account_type = 'Expenses', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '43'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '4301';

UPDATE accounts
SET name_ar = 'مصاريف الإيجارات', name_en = 'Rent Expenses', account_type = 'Expenses', category = 'Detail', level = 3,
    parent_id = (SELECT id FROM accounts WHERE code = '43'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '4302';

UPDATE accounts
SET name_ar = 'مسحوبات', name_en = 'Withdrawals', account_type = 'Expenses', category = 'Detail', level = 2,
    parent_id = (SELECT id FROM accounts WHERE code = '4'),
    is_active = 1, updated_at = datetime('now')
WHERE code = '44';

-- =========================
-- C) Safe cleanup of deprecated legacy accounts
-- =========================

-- Remove legacy child variants if present and unused
DELETE FROM accounts
WHERE code IN ('120101', '130101', '210101', '300201', '400101', '500101', '510501')
  AND id NOT IN (SELECT DISTINCT account_id FROM journal_lines);

-- Remove deprecated legacy accounts requested by product owner (only if unused)
DELETE FROM accounts
WHERE code IN ('1301', '2101', '3002', '4001', '5001', '5105')
  AND id NOT IN (SELECT DISTINCT account_id FROM journal_lines);

-- Optional: normalize obsolete labels when these rows could not be deleted due to references
-- (keeps reports cleaner while preserving historical FK integrity)
UPDATE accounts
SET name_ar = 'حساب قديم (مدينون)', name_en = 'Legacy Receivables Account', notes = COALESCE(notes, '') || ' [LEGACY-KEPT]', updated_at = datetime('now')
WHERE code = '1301' AND id IN (SELECT DISTINCT account_id FROM journal_lines);

UPDATE accounts
SET name_ar = 'حساب قديم (دائنون)', name_en = 'Legacy Payables Account', notes = COALESCE(notes, '') || ' [LEGACY-KEPT]', updated_at = datetime('now')
WHERE code = '2101' AND id IN (SELECT DISTINCT account_id FROM journal_lines);

UPDATE accounts
SET name_ar = 'حساب قديم (رصيد افتتاحي)', name_en = 'Legacy Opening Balance Account', notes = COALESCE(notes, '') || ' [LEGACY-KEPT]', updated_at = datetime('now')
WHERE code = '3002' AND id IN (SELECT DISTINCT account_id FROM journal_lines);

UPDATE accounts
SET name_ar = 'حساب قديم (إيرادات المبيعات)', name_en = 'Legacy Sales Revenue Account', notes = COALESCE(notes, '') || ' [LEGACY-KEPT]', updated_at = datetime('now')
WHERE code = '4001' AND id IN (SELECT DISTINCT account_id FROM journal_lines);

UPDATE accounts
SET name_ar = 'حساب قديم (تكلفة البضاعة المباعة)', name_en = 'Legacy COGS Account', notes = COALESCE(notes, '') || ' [LEGACY-KEPT]', updated_at = datetime('now')
WHERE code = '5001' AND id IN (SELECT DISTINCT account_id FROM journal_lines);

UPDATE accounts
SET name_ar = 'حساب قديم (خسائر المواد التالفة)', name_en = 'Legacy Damaged Loss Account', notes = COALESCE(notes, '') || ' [LEGACY-KEPT]', updated_at = datetime('now')
WHERE code = '5105' AND id IN (SELECT DISTINCT account_id FROM journal_lines);
