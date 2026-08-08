-- 148: Account purpose (semantic classification replacing code-prefix matching)
--
-- Spec Sec 46: account *purpose* is explicit so the accounting engine never
-- relies on brittle code-prefix string matching (44 / 1203 / 2203 / 1204 / 11 /
-- 51 / 52 / 53 / 54). The column is nullable for legacy rows until backfilled;
-- new accounts carry a purpose from creation. Backfill below derives the
-- purpose from the well-known chart conventions (the same rules the old
-- is_drawings / is_receivable / is_payable / subledger-kind guards used).

ALTER TABLE accounts ADD COLUMN purpose TEXT;

UPDATE accounts SET purpose = 'general';

UPDATE accounts SET purpose = 'partner_drawings'
  WHERE code LIKE '44%';

UPDATE accounts SET purpose = 'receivable'
  WHERE code LIKE '1203%' AND account_type = 'Assets';

UPDATE accounts SET purpose = 'payable'
  WHERE code LIKE '2203%' AND account_type = 'Liabilities';

UPDATE accounts SET purpose = 'inventory'
  WHERE code LIKE '1204%' AND account_type = 'Assets';

UPDATE accounts SET purpose = 'fixed_asset'
  WHERE code LIKE '11%' AND account_type = 'Assets';

UPDATE accounts SET purpose = 'partner_capital'
  WHERE code LIKE '51%';

UPDATE accounts SET purpose = 'retained_earnings'
  WHERE code = '52';

UPDATE accounts SET purpose = 'opening_balance_equity'
  WHERE code = '53';

UPDATE accounts SET purpose = 'partner_current'
  WHERE code LIKE '54%';
