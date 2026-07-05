-- Migration 134: Ensure Discount Earned account 332 exists under "إيرادات أخرى" (33)
-- Handles migration 133 being applied with wrong code 3301, or account missing entirely.

-- 1. Ensure parent "إيرادات أخرى" (33) exists under root Revenue (3)
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000033', '33', 'إيرادات أخرى', 'Other Revenue', 'Revenue', p.id, 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '3'
AND NOT EXISTS (SELECT 1 FROM accounts WHERE code = '33');

-- 2. If account 3301 exists (from botched 133), rename to 332
UPDATE accounts SET code = '332', name_ar = 'الخصوم المكتسبة', name_en = 'Discount Earned', updated_at = datetime('now') WHERE code = '3301';

-- 3. If 332 still doesn't exist, insert it under 33 (fallback to 3 if 33 missing)
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000332', '332', 'الخصوم المكتسبة', 'Discount Earned', 'Revenue',
  COALESCE((SELECT id FROM accounts WHERE code = '33'), (SELECT id FROM accounts WHERE code = '3')),
  'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '332');
