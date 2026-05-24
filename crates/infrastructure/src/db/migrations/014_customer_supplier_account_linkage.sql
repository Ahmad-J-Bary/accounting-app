-- Migration 014: Add accounting linkage fields to customers and suppliers
-- Links customers/suppliers to chart of accounts for proper double-entry accounting

-- Add accounting columns to customers
ALTER TABLE customers ADD COLUMN code TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN account_id TEXT;
ALTER TABLE customers ADD COLUMN debit TEXT NOT NULL DEFAULT '0';
ALTER TABLE customers ADD COLUMN credit TEXT NOT NULL DEFAULT '0';
ALTER TABLE customers ADD COLUMN opening_balance TEXT NOT NULL DEFAULT '0';
ALTER TABLE customers ADD COLUMN currency TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN notes TEXT;

-- Add accounting columns to suppliers
ALTER TABLE suppliers ADD COLUMN code TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN account_id TEXT;
ALTER TABLE suppliers ADD COLUMN debit TEXT NOT NULL DEFAULT '0';
ALTER TABLE suppliers ADD COLUMN credit TEXT NOT NULL DEFAULT '0';
ALTER TABLE suppliers ADD COLUMN opening_balance TEXT NOT NULL DEFAULT '0';
ALTER TABLE suppliers ADD COLUMN currency TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN notes TEXT;

-- Add linkage columns to accounts
ALTER TABLE accounts ADD COLUMN linked_customer_id TEXT;
ALTER TABLE accounts ADD COLUMN linked_supplier_id TEXT;

-- Update existing customer balances: migrate old 'balance' to debit (customers are typically debtors)
UPDATE customers SET debit = balance, balance = debit - credit WHERE debit = '0' AND credit = '0' AND balance != '0';

-- Update existing supplier balances: migrate old 'balance' to credit (suppliers are typically creditors)
UPDATE suppliers SET credit = balance, balance = credit - debit WHERE debit = '0' AND credit = '0' AND balance != '0';

-- Add foreign key info via comments (SQLite doesn't enforce FK on ALTER)
-- account_id in customers -> accounts.id
-- account_id in suppliers -> accounts.id
-- linked_customer_id in accounts -> customers.id
-- linked_supplier_id in accounts -> suppliers.id
