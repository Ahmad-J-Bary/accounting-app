-- Migration 133: Add Discount Earned (خصوم مكتسبة) account under Other Revenue
-- This account tracks purchase discounts as revenue (full double-entry treatment)

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000332', '332', 'خصوم مكتسبة', 'Discount Earned', 'Revenue', p.id, 'Detail', 3, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '33';
