-- 167: Backfill missing partner drawings accounts
--
-- Partners created before migration 017 (which added drawings_account_id)
-- may have NULL drawings_account_id. This migration creates the missing
-- drawings accounts and links them to the partners.
--
-- For each partner without drawings_account_id:
--   1. Find or ensure the parent account "44 مسحوبات الشركاء" exists
--   2. Create a detail drawings account "44X" under it
--   3. Link the account to the partner

-- Ensure the drawings parent account (44) exists
INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT
    '00000000-0000-0000-0000-000000000044',
    '44',
    'مسحوبات الشركاء',
    'Partner Drawings',
    'Equity',
    (SELECT id FROM accounts WHERE code = '4'),
    'Summary',
    2,
    '0',
    '0',
    1,
    datetime('now'),
    datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '44');

-- For each partner without drawings_account_id, create a drawings account
-- and link it. Uses a temporary table to collect partner info, then inserts
-- accounts and updates partners in order.
INSERT INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level,
 opening_balance, balance, debit, credit, currency_code, exchange_rate,
 notes, is_active, is_default, is_final, purpose, created_at, updated_at)
SELECT
    lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)),1,4) || '-4' || substr(hex(randomblob(2)),2,3) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2,3) || '-' || hex(randomblob(6))) as id,
    '44' || p.code as code,
    'مسحوبات ' || p.name as name_ar,
    'Drawings - ' || p.name as name_en,
    'Equity',
    (SELECT id FROM accounts WHERE code = '44'),
    'Detail',
    3,
    '0',
    '0',
    '0',
    '0',
    p.currency,
    p.exchange_rate,
    'حساب مسحوبات الشريك ' || p.name,
    1,
    0,
    1,
    'partner_drawings',
    datetime('now'),
    datetime('now')
FROM partners p
WHERE p.drawings_account_id IS NULL
  AND EXISTS (SELECT 1 FROM accounts WHERE code = '44');

-- Link the newly created drawings accounts to their partners
UPDATE partners
SET drawings_account_id = (
    SELECT a.id FROM accounts a
    WHERE a.code = '44' || partners.code
      AND a.purpose = 'partner_drawings'
    LIMIT 1
),
updated_at = datetime('now')
WHERE drawings_account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.code = '44' || partners.code
      AND a.purpose = 'partner_drawings'
  );

-- Also backfill current_account_id if missing (from migration 147)
INSERT INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level,
 opening_balance, balance, debit, credit, currency_code, exchange_rate,
 notes, is_active, is_default, is_final, purpose, created_at, updated_at)
SELECT
    lower(hex(randomblob(4)) || '-' || substr(hex(randomblob(2)),1,4) || '-4' || substr(hex(randomblob(2)),2,3) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2,3) || '-' || hex(randomblob(6))) as id,
    '54' || p.code as code,
    'حساب جاري ' || p.name as name_ar,
    'Current - ' || p.name as name_en,
    'Equity',
    (SELECT id FROM accounts WHERE code = '54'),
    'Detail',
    3,
    '0',
    '0',
    '0',
    '0',
    p.currency,
    p.exchange_rate,
    'الحساب الجاري للشريك ' || p.name,
    1,
    0,
    1,
    'partner_current',
    datetime('now'),
    datetime('now')
FROM partners p
WHERE p.current_account_id IS NULL
  AND EXISTS (SELECT 1 FROM accounts WHERE code = '54');

UPDATE partners
SET current_account_id = (
    SELECT a.id FROM accounts a
    WHERE a.code = '54' || partners.code
      AND a.purpose = 'partner_current'
    LIMIT 1
),
updated_at = datetime('now')
WHERE current_account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.code = '54' || partners.code
      AND a.purpose = 'partner_current'
  );
