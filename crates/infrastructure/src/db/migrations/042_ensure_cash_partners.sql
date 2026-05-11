-- Migration 042: Ensure "Cash Customer" and "Cash Supplier" exist in their respective tables
-- Linked to accounts 1230 and 2230

-- 1) Ensure زبون نقدي exists in customers
INSERT INTO customers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at)
SELECT 
    '00000000-0000-0000-0000-000000000010', -- Fixed ID for Cash Customer
    '0', -- Code 0
    'زبون نقدي', 
    '', 
    '', 
    id, 
    '0', '0', '0', '0', 'SYP', 'حساب نقدي افتراضي', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '1230'
AND NOT EXISTS (SELECT 1 FROM customers WHERE code = '0' OR name = 'زبون نقدي');

-- 2) Ensure مورد نقدي exists in suppliers
INSERT INTO suppliers (id, code, name, phone, address, account_id, debit, credit, opening_balance, balance, currency, notes, is_active, created_at, updated_at)
SELECT 
    '00000000-0000-0000-0000-000000000020', -- Fixed ID for Cash Supplier
    '0', -- Code 0
    'مورد نقدي', 
    '', 
    '', 
    id, 
    '0', '0', '0', '0', 'SYP', 'حساب نقدي افتراضي', 1, datetime('now'), datetime('now')
FROM accounts WHERE code = '2230'
AND NOT EXISTS (SELECT 1 FROM suppliers WHERE code = '0' OR name = 'مورد نقدي');

-- 3) Update account linkage (link back to customer/supplier)
UPDATE accounts SET linked_customer_id = '00000000-0000-0000-0000-000000000010' WHERE code = '1230';
UPDATE accounts SET linked_supplier_id = '00000000-0000-0000-0000-000000000020' WHERE code = '2230';
