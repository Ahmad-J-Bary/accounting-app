-- Migration 135: Add Discount Granted account 47 under "المصروفات" (4)
-- حسم ممنوح / Discount Granted — expense for discounts given to customers

-- 1. Add account 47 if not exists (under root Expenses code 4)
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000047', '47', 'الخصوم الممنوحة', 'Discount Granted', 'Expenses',
  COALESCE((SELECT id FROM accounts WHERE code = '4'), (SELECT id FROM accounts WHERE code = '0')),
  'Detail', 2, '0', '0', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '47');
