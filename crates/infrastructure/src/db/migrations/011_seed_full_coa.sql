-- Migration 011: Seed full hierarchical Chart of Accounts (stable seed-only)
-- IMPORTANT:
-- - Keep this migration immutable once applied.
-- - This migration only seeds the required hierarchy with INSERT OR IGNORE.
-- - No destructive cleanup or legacy remapping here (moved to later migration).

-- ============================================================
-- 1) ROOT ACCOUNTS
-- ============================================================

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

-- ============================================================
-- 2) ASSETS
-- ============================================================

-- 1.1 الأصول الثابتة
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

-- 1.2 الأصول المتداولة
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

-- ============================================================
-- 3) LIABILITIES
-- ============================================================

-- 2.1 الخصوم الثابتة
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000021', '21', 'الخصوم الثابتة', 'Fixed Liabilities', 'Liabilities', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '2';

-- 2.2 الخصوم المتداولة
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

-- ============================================================
-- 4) REVENUE
-- ============================================================

-- 3.1 المبيعات
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

-- 3.2 مرتجع المشتريات
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000032', '32', 'مرتجع المشتريات', 'Purchase Returns', 'Revenue', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '3';

-- 3.3 إيرادات أخرى
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000033', '33', 'إيرادات أخرى', 'Other Revenue', 'Revenue', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '3';

-- ============================================================
-- 5) EXPENSES
-- ============================================================

-- 4.1 المشتريات
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000041', '41', 'المشتريات', 'Purchases', 'Expenses', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';

-- 4.2 مرتجع المبيعات
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000042', '42', 'مرتجع المبيعات', 'Sales Returns', 'Expenses', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';

-- 4.3 مصاريف أخرى
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

-- 4.4 مسحوبات
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000044', '44', 'مسحوبات', 'Withdrawals', 'Expenses', p.id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';
