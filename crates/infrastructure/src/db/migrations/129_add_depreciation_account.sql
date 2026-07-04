-- Migration 129: Add depreciation expense account (46) under root Expenses

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000046', '46', 'مصروف الإهلاك', 'Depreciation Expense', 'Expenses', id, 'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '4';
