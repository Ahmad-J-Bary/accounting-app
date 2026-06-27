-- Migration 124: Rename Opening Balance Equity account from 3002 to 224
-- Aligns with the chart of accounts structure where equity sub-accounts are under 22x.
-- The internal UUID remains unchanged so existing journal entries stay linked.
-- Also restores the name and parent in case migration 013 marked it as legacy with NULL parent.

-- Ensure parent account (code '22' = الخصوم المتداولة) exists
INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES 
('00000000-0000-0000-0000-000000000022', '22', 'الخصوم المتداولة', 'Current Liabilities', 'Liabilities', (SELECT id FROM accounts WHERE code = '2'), 'Summary', 2, '0', '0', 1, datetime('now'), datetime('now'));

-- Rename account code from 3002 to 224, restore name and attach under الخصوم المتداولة
UPDATE accounts 
SET code = '224',
    name_ar = 'رصيد افتتاحي',
    name_en = 'Opening Balance Equity',
    account_type = 'Equity',
    parent_id = (SELECT id FROM accounts WHERE code = '22'),
    category = 'Detail',
    level = 3,
    is_active = 1,
    notes = ''
WHERE code = '3002' OR code = '224';
