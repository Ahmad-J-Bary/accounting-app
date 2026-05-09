-- Migration 037: Force Ensure Required System Accounts exist
-- This ensures critical hierarchy nodes for customers, suppliers, and partners.

-- 1. Roots
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES 
('00000000-0000-0000-0000-000000000001', '1', 'الأصول', 'Assets', 'Assets', NULL, 'Summary', 1, '0', '0', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES 
('00000000-0000-0000-0000-000000000002', '2', 'الخصوم', 'Liabilities', 'Liabilities', NULL, 'Summary', 1, '0', '0', 1, datetime('now'), datetime('now'));

-- 2. Major Branches
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000012', '12', 'الأصول المتداولة', 'Current Assets', 'Assets', id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '1';

INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000022', '22', 'الخصوم المتداولة', 'Current Liabilities', 'Liabilities', id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '2';

-- 3. Specific Required Accounts
-- Receivables (1203)
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001230', '1203', 'المدينون (العملاء والزبائن)', 'Accounts Receivable', 'Assets', id, 'Summary', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '12';

-- Payables (2203)
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000002230', '2203', 'الدائنون (الموردون)', 'Accounts Payable', 'Liabilities', id, 'Summary', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '22';

-- Capital (2202)
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000002202', '2202', 'رأس المال', 'Capital', 'Equity', id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '22';

-- 4. Ensure they are active (in case they existed but were deactivated)
UPDATE accounts SET is_active = 1 WHERE code IN ('1203', '2203', '2202', '3002');
