-- Migration 036: Ensure Opening Balance Equity Account (3002) exists
-- This account is essential for balancing opening balances of customers, suppliers, and partners.

INSERT OR IGNORE INTO accounts 
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, created_at, updated_at)
VALUES 
(
    '00000000-0000-0000-0000-000000003002', 
    '3002', 
    'رصيد افتتاحي', 
    'Opening Balance Equity', 
    'Equity', 
    (SELECT id FROM accounts WHERE code = '22'), 
    'Detail', 
    3, 
    '0', 
    '0', 
    1, 
    datetime('now'), 
    datetime('now')
);
