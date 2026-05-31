-- Migration 109: Add dedicated leaf account for damaged item losses
-- Creates account 433 "خسائر المواد التالفة" under 43 (مصاريف أخرى)
-- This replaces the old legacy account 5105 which was deprecated in migration 013.

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT
    '00000000-0000-0000-0000-000000004303',
    '433',
    'خسائر المواد التالفة',
    'Loss from Damaged Items',
    'Expenses',
    p.id,
    'Detail',
    3,
    '0',
    '0',
    1,
    datetime('now'),
    datetime('now')
FROM accounts p WHERE p.code = '43';

-- Ensure parent 43 is marked as Summary (not final) since it now has a new child
UPDATE accounts SET category = 'Summary', is_final = 0 WHERE code = '43';
