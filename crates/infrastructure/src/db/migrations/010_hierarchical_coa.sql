-- Migration 010: Hierarchical Chart of Accounts
-- Adds columns for parent-child relationship and seeds the standard hierarchical structure.

-- 1. Add columns to accounts table
ALTER TABLE accounts ADD COLUMN category TEXT DEFAULT 'Detail'; -- 'Summary' or 'Detail'
ALTER TABLE accounts ADD COLUMN level INTEGER DEFAULT 1;
ALTER TABLE accounts ADD COLUMN opening_balance TEXT DEFAULT '0';
ALTER TABLE accounts ADD COLUMN notes TEXT;

-- 2. Clean up or reorganize existing accounts to fit the new structure
-- (We'll update existing ones instead of deleting them to preserve history if any)

-- Root: الأصول (Assets) - Level 1
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', '1', 'الأصول', 'Assets', 'Assets', NULL, '0', 1, 'Summary', 1, datetime('now'), datetime('now'));

-- 1.1 الأصول الثابتة - Level 2
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000101', '11', 'الأصول الثابتة', 'Fixed Assets', 'Assets', '00000000-0000-0000-0000-000000000001', '0', 1, 'Summary', 2, datetime('now'), datetime('now'));

-- 1.1.1 أبنية وأراضي
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000001101', '1101', 'أبنية وأراضي', 'Buildings & Land', 'Assets', '00000000-0000-0000-0000-000000000101', '0', 1, 'Detail', 3, datetime('now'), datetime('now'));

-- 1.2 الأصول المتداولة - Level 2
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000102', '12', 'الأصول المتداولة', 'Current Assets', 'Assets', '00000000-0000-0000-0000-000000000001', '0', 1, 'Summary', 2, datetime('now'), datetime('now'));

-- 1.2.2 الصندوق (تعديل الحساب الموجود سابقا إذا وجد)
UPDATE accounts SET parent_id = '00000000-0000-0000-0000-000000000102', level = 3, category = 'Detail' WHERE code = '1101';

-- Root: الخصوم (Liabilities) - Level 1
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000002', '2', 'الخصوم', 'Liabilities', 'Liabilities', NULL, '0', 1, 'Summary', 1, datetime('now'), datetime('now'));

-- 2.2 الخصوم المتداولة - Level 2
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000202', '22', 'الخصوم المتداولة', 'Current Liabilities', 'Liabilities', '00000000-0000-0000-0000-000000000002', '0', 1, 'Summary', 2, datetime('now'), datetime('now'));

-- Root: الإيرادات (Revenue) - Level 1
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000003', '3', 'الإيرادات', 'Revenue', 'Revenue', NULL, '0', 1, 'Summary', 1, datetime('now'), datetime('now'));

-- Root: المصروفات (Expenses) - Level 1
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000004', '4', 'المصروفات', 'Expenses', 'Expenses', NULL, '0', 1, 'Summary', 1, datetime('now'), datetime('now'));

-- Default Customers/Suppliers
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000001203', '120301', 'زبون نقدي', 'Cash Customer', 'Assets', '00000000-0000-0000-0000-000000000102', '0', 1, 'Detail', 3, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, category, level, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000002203', '220301', 'مورد نقدي', 'Cash Supplier', 'Liabilities', '00000000-0000-0000-0000-000000000202', '0', 1, 'Detail', 3, datetime('now'), datetime('now'));
