-- 156: Bank / Loan ledger accounts + inventory purpose backfill
--
-- Existing-company opening-balance reconciliation requires every "amount-only"
-- section (النقد والبنوك / القروض / المخزون) to resolve a REAL ledger account.
-- The seeded chart had no bank (أصل) or loan (التزام) accounts, so the wizard's
-- default account resolution returned "" and the amounts were silently dropped
-- from the migration lines (GL Dr 305 / Cr 415 instead of the balanced
-- 465/465). Purpose (Sec 46) is set explicitly so the engine never relies on
-- name/code matching.
--
-- Codes follow the post-015 numbering (1 digit per level):
--   - 12 الأصول المتداولة: 121 بضاعة أول المدة (detail), 122 الصندوق (detail),
--     123 المدينون (summary), 124 المخزون (summary) -> 125 البنوك (detail)
--   - 22 الخصوم المتداولة: 221/222/223/224 taken -> 225 القروض (detail)

-- Bank ledger account (Asset / Current) - البنوك
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, is_final, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000001205', '125', 'البنوك', 'Banks', 'Assets', p.id, 'Detail', 3, 1, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '12';

-- Loan ledger account (Liability / Current) - القروض
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, is_final, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000002205', '225', 'القروض', 'Loans', 'Liabilities', p.id, 'Detail', 3, 1, '0', '0', 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '22';

-- Explicit purposes (backfill even if the rows pre-existed with a wrong purpose).
UPDATE accounts SET purpose = 'bank', updated_at = datetime('now')
  WHERE id = '00000000-0000-0000-0000-000000001205';

UPDATE accounts SET purpose = 'loan', updated_at = datetime('now')
  WHERE id = '00000000-0000-0000-0000-000000002205';

-- 121 بضاعة أول المدة is the opening-stock (inventory) asset; the 148 backfill
-- only mapped 1204/124 to inventory, leaving 121 as general.
UPDATE accounts SET purpose = 'inventory', updated_at = datetime('now')
  WHERE id = '00000000-0000-0000-0000-000000001201' OR code = '121';
