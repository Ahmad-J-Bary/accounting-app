-- 157: Fix Chart of Accounts hierarchy
--
-- Phase 2 audit fixes (post-015 numbering: one digit per level):
--   1) Loans: 225 -> 224 (the historical "224" was Opening Balance Equity,
--      converted to 53 by migration 128 / pool.rs; 224 is now free for loans).
--      Same account id, so posted journal lines stay untouched.
--   2) Partner Current Accounts (54): must hang under the equity root (5).
--      No migration creates the "5" equity root (pool.rs does, AFTER all
--      migrations), so 147 created 54 with parent NULL on fresh databases.
--   3) Partner Drawings (44): account_type is Equity (143) but the parent is
--      still the Expenses group (4). Re-parent 44 under the equity root.
--   4) Level normalization: level must equal the numeric code length (Sec 015).
--      Fixes partner capital detail accounts (511/512/513 level 4 -> 3).
--   5) Enforce unique account codes within the single-tenant company.
--
-- NOTE: "53" Opening Balance Equity is created here (if missing) BEFORE the
-- loan renumber so the pool.rs boot-time ensure sees code '53' existing and
-- does not rename the new loan (224) into the OBE account (pool.rs renames any
-- remaining code '224' -> '53' when '53' is absent).

-- 1) Ensure the equity root (5) exists (mirror of pool.rs ensure); the
--    parent sub-select resolves to NULL because no "0" root row exists.
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000005', '5', 'حقوق الملكية', 'Equity', 'Equity', (SELECT id FROM accounts WHERE code = '0'), 'Summary', 1, '0', '0', 'general', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '5');

-- 2) Ensure "رصيد افتتاحي" (53) exists so pool.rs never renames code '224'
--    (now the Loans detail account) into the OBE during boot-time ensure.
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000053', '53', 'رصيد افتتاحي', 'Opening Balance Equity', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Detail', 2, '0', '0', 'opening_balance_equity', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '53');

-- 3) Reclassify القروض from code 225 to 224 (same account id -> posted lines
--    stay valid; never delete an account used by posted transactions).
UPDATE accounts
SET code = '224', updated_at = datetime('now')
WHERE code = '225'
  AND NOT EXISTS (SELECT 1 FROM accounts WHERE code = '224');

-- 4) Partner Current Accounts: canonical home under the equity root (5).
UPDATE accounts
SET parent_id = (SELECT id FROM accounts WHERE code = '5'),
    account_type = 'Equity',
    category = 'Summary',
    level = 2,
    purpose = 'partner_current',
    updated_at = datetime('now')
WHERE code = '54';

-- 5) Partner Drawings: contra-equity, must hang under the equity root (5),
--    never under the Expenses group (4).
UPDATE accounts
SET parent_id = (SELECT id FROM accounts WHERE code = '5'),
    account_type = 'Equity',
    category = 'Summary',
    level = 2,
    purpose = 'partner_drawings',
    updated_at = datetime('now')
WHERE code = '44';

-- 6) Normalize levels to the numeric code length (one digit per level).
UPDATE accounts
SET level = LENGTH(code), updated_at = datetime('now')
WHERE code GLOB '[0-9]*' AND LENGTH(code) BETWEEN 1 AND 6 AND level <> LENGTH(code);

-- 7) Enforce unique account codes within the company (single-tenant).
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_code_unique ON accounts(code);