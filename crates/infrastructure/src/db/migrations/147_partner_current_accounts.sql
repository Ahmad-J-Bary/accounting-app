-- 147: Partner current/profit account
--
-- Equity must keep Partner Capital distinct from Partner Current (profit)
-- accounts (spec Sec 4 / Sec 13 / Sec 37): registered capital is master data,
-- profit allocations accumulate in a separate per-partner current account, and
-- the partner's net equity is (capital ledger + profit current) − drawings.
--
-- 1) New chart parent "54 حسابات جارية للشركاء" (Partner Current Accounts)
--    under the equity group "5". Each partner gets a detail account under it.
-- 2) `partners.current_account_id` links a partner to their current account so
--    profit distributions and the equity statement target a dedicated home.

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000054', '54', 'حسابات جارية للشركاء', 'Partner Current Accounts', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '54');

ALTER TABLE partners ADD COLUMN current_account_id TEXT NULL;