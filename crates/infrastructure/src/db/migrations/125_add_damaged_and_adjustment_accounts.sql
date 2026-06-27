-- Migration 125: Add accounts for damaged items and stock adjustment gains/losses

-- Create 45 = خسائر المواد التالفة والتسويات under parent 4 (المصروفات)
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000045', '45', 'خسائر المواد التالفة والتسويات', 'Damaged & Adjustment Losses', 'Expenses', id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '4';

-- Ensure parent 33 (إيرادات أخرى) exists and is Summary
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000033', '33', 'إيرادات أخرى', 'Other Revenue', 'Revenue', id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '3';
UPDATE accounts SET category = 'Summary', is_final = 0 WHERE code = '33';

-- Create 331 = أرباح تسوية المخزون under parent 33
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000331', '331', 'أرباح تسوية المخزون', 'Inventory Adjustment Gains', 'Revenue', id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '33';

-- Ensure 124 (المخزون) has correct category
UPDATE accounts SET category = 'Summary', is_final = 0 WHERE code = '124';
