-- Migration 040: Seed Accounting Scenario - 31/01/2017
-- This seeds the 12 journal entries for the accounting scenario
-- Exchange rate: 1 USD = 100 L.S.

-- ============================================================
-- 1) Add Customer: خالد (Khalid)
-- ============================================================
INSERT OR IGNORE INTO customers (id, name, code, email, phone, address, account_id, debit, credit, opening_balance, currency, notes, created_at, updated_at)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'خالد',
    'C001',
    'khalid@example.com',
    '',
    '',
    NULL,
    '0',
    '0',
    '0',
    'SYP',
    'عميل للسيناريو المحاسبي',
    datetime('now'),
    datetime('now')
);

-- ============================================================
-- 2) Add Supplier: شركة الشريف التجارية
-- ============================================================
INSERT OR IGNORE INTO suppliers (id, name, code, email, phone, address, account_id, debit, credit, opening_balance, currency, notes, created_at, updated_at)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'شركة الشريف التجارية',
    'S001',
    'sharif@example.com',
    '',
    '',
    NULL,
    '0',
    '0',
    '0',
    'SYP',
    'مورد للسيناريو المحاسبي',
    datetime('now'),
    datetime('now')
);

-- ============================================================
-- 3) Create Customer Account (120302) - Khalid
-- ============================================================
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, is_default, is_final, linked_customer_id, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000120302', '120302', 'خالد', 'Khalid', 'Assets', p.id, 'Detail', 4, '0', '0', 1, 0, 1, '11111111-1111-1111-1111-111111111111', datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '1203';

UPDATE customers SET account_id = '00000000-0000-0000-0000-000000120302' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE accounts SET linked_customer_id = '11111111-1111-1111-1111-111111111111' WHERE id = '00000000-0000-0000-0000-000000120302';

-- ============================================================
-- 4) Create Supplier Account (220302) - شركة الشريف
-- ============================================================
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, is_default, is_final, linked_supplier_id, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000220302', '220302', 'شركة الشريف التجارية', 'Sharif Trading Co', 'Liabilities', p.id, 'Detail', 4, '0', '0', 1, 0, 1, '22222222-2222-2222-2222-222222222222', datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '2203';

UPDATE suppliers SET account_id = '00000000-0000-0000-0000-000000220302' WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE accounts SET linked_supplier_id = '22222222-2222-2222-2222-222222222222' WHERE id = '00000000-0000-0000-0000-000000220302';

-- ============================================================
-- 5) Create Additional Accounts needed
-- ============================================================

-- مسحوبات (44)
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, is_default, is_final, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000044', '44', 'مسحوبات', 'Withdrawals', 'Expenses', p.id, 'Detail', 2, '0', '0', 1, 0, 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '4';

-- Create salesreceivable account if not exists
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, is_default, is_final, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000003103', '3103', 'مستحقات продаж', 'Sales Receivable', 'Assets', p.id, 'Detail', 3, '0', '0', 1, 0, 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '31';

-- Create purchasepayable account if not exists
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, is_active, is_default, is_final, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000002204', '2204', 'مستحقات مشتريات', 'Purchase Payable', 'Liabilities', p.id, 'Detail', 3, '0', '0', 1, 0, 1, datetime('now'), datetime('now')
FROM accounts p WHERE p.code = '22';

-- ============================================================
-- 6) Insert Journal Entries (12 entries)
-- All dated 31/01/2017
-- Exchange rate: 100 L.S. = 1 USD
-- ============================================================

-- Entry 1: Opening Balance - Account منصور (zero balance)
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0001', '1', 'AccountOpeningBalance', NULL, '2017-01-31T00:00:00Z', 'رصيد افتتاحي للحساب منصور', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0001-1', 'entry-0001', '00000000-0000-0000-0000-000000000001', NULL, 'SYP', '1', '0', '0', '0', '0', 'رصيد افتتاحي', '2017-01-31T00:00:00Z');

-- Entry 2: Opening Balance - Account شركة الشريف (zero balance)
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0002', '2', 'AccountOpeningBalance', NULL, '2017-01-31T00:00:00Z', 'رصيد افتتاحي للحساب شركة الشريف', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0002-1', 'entry-0002', '00000000-0000-0000-0000-000000000002', NULL, 'SYP', '1', '0', '0', '0', '0', 'رصيد افتتاحي', '2017-01-31T00:00:00Z');

-- Entry 3: Opening Balance - Account الإكراميات (zero balance)
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0003', '3', 'AccountOpeningBalance', NULL, '2017-01-31T00:00:00Z', 'رصيد افتتاحي للحساب الإكراميات', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0003-1', 'entry-0003', '00000000-0000-0000-0000-000000000003', NULL, 'SYP', '1', '0', '0', '0', '0', 'رصيد افتتاحي', '2017-01-31T00:00:00Z');

-- Entry 4: Capital Deposit - إيداع رأس المال في الخزينة
-- Debit: الصندوق (1202) - 2,000,000 ل.س
-- Credit: رأس المال (2202) - 2,000,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0004', '4', 'CashOpeningBalance', NULL, '2017-01-31T00:00:00Z', 'إيداع رأس المال بالصندوق', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0004-1', 'entry-0004', '00000000-0000-0000-0000-000000001202', NULL, 'SYP', '1', '2000000', '2000000', '0', '0', 'إيداع رأس المال - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0004-2', 'entry-0004', '00000000-0000-0000-0000-000000002202', NULL, 'SYP', '1', '0', '0', '2000000', '2000000', 'رأس المال - دائن', '2017-01-31T00:00:00Z');

-- Entry 5: Opening Stock - بضاعة أول المدة
-- Debit: بضاعة أول المدة (1201) - 450,000 ل.س
-- Credit: مستحقات مشتريات (2204) - 450,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0005', '5', 'MaterialOpeningBalance', 'FV-1', '2017-01-31T00:00:00Z', 'إنشاء فاتورة مواد أول المدة رقم 1', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0005-1', 'entry-0005', '00000000-0000-0000-0000-000000001201', NULL, 'SYP', '1', '450000', '450000', '0', '0', 'بضاعة أول المدة - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0005-2', 'entry-0005', '00000000-0000-0000-0000-000000002204', NULL, 'SYP', '1', '0', '0', '450000', '450000', 'مستحقات مشتريات - دائن', '2017-01-31T00:00:00Z');

-- Entry 6: Purchase Invoice - فاتورة مشتريات من المورد
-- Debit: المشتريات (41) - 625,000 ل.س
-- Credit: المورد (220302) - 625,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0006', '6', 'PurchaseJournal', 'PV-2', '2017-01-31T00:00:00Z', 'إنشاء فاتورة مشتريات رقم 2', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0006-1', 'entry-0006', '00000000-0000-0000-0000-000000000041', NULL, 'SYP', '1', '625000', '625000', '0', '0', 'مشتريات - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0006-2', 'entry-0006', '00000000-0000-0000-0000-000000220302', '22222222-2222-2222-2222-222222222222', 'SYP', '1', '0', '0', '625000', '625000', 'شركة الشريف التجارية - دائن', '2017-01-31T00:00:00Z');

-- Entry 7: Additional Costs on Purchase
-- Debit: تكاليف إضافية (2201) - 10,000 ل.س
-- Credit: الصندوق (1202) - 10,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0007', '7', 'PurchaseCostsJournal', 'PV-2-cost', '2017-01-31T00:00:00Z', 'تكاليف إضافية مرتبطة بفاتورة مشتريات', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0007-1', 'entry-0007', '00000000-0000-0000-0000-000000002201', '22222222-2222-2222-2222-222222222222', 'SYP', '1', '10000', '10000', '0', '0', 'تكاليف إضافية - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0007-2', 'entry-0007', '00000000-0000-0000-0000-000000001202', '22222222-2222-2222-2222-222222222222', 'SYP', '1', '0', '0', '10000', '10000', 'الصندوق - دائن', '2017-01-31T00:00:00Z');

-- Entry 8: Payment Voucher - سند دفع للتكاليف الإضافية
-- Debit: المورد (220302) - 10,000 ل.س
-- Credit: الصندوق (1202) - 10,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0008', '8', 'CashPayment', 'PV-8', '2017-01-31T00:00:00Z', 'دفعة أولى لتسديد التكاليف الإضافية على المشتريات', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0008-1', 'entry-0008', '00000000-0000-0000-0000-000000220302', '22222222-2222-2222-2222-222222222222', 'SYP', '1', '10000', '10000', '0', '0', 'شركة الشريف - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0008-2', 'entry-0008', '00000000-0000-0000-0000-000000001202', NULL, 'SYP', '1', '0', '0', '10000', '10000', 'الصندوق - دائن', '2017-01-31T00:00:00Z');

-- Entry 9: Sales Invoice - فاتورة مبيعات للعميل
-- Debit: العميل (120302) - 191,000 ل.س
-- Credit: المبيعات الآجلة (3102) - 191,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0009', '9', 'CreditSalesJournal', 'SV-1', '2017-01-31T00:00:00Z', 'إنشاء فاتورة مبيعات رقم 1', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0009-1', 'entry-0009', '00000000-0000-0000-0000-000000120302', '11111111-1111-1111-1111-111111111111', 'SYP', '1', '191000', '191000', '0', '0', 'خالد - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0009-2', 'entry-0009', '00000000-0000-0000-0000-000000003102', NULL, 'SYP', '1', '0', '0', '191000', '191000', 'المبيعات الآجلة - دائن', '2017-01-31T00:00:00Z');

-- Entry 10: Receipt Voucher - سند قبض من العميل
-- Debit: الصندوق (1202) - 100,000 ل.س
-- Credit: العميل (120302) - 100,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0010', '10', 'CashReceipt', 'RV-10', '2017-01-31T00:00:00Z', 'دفعة أولى من عميل عند إنشاء الفاتورة', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0010-1', 'entry-0010', '00000000-0000-0000-0000-000000001202', '11111111-1111-1111-1111-111111111111', 'SYP', '1', '100000', '100000', '0', '0', 'الصندوق - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0010-2', 'entry-0010', '00000000-0000-0000-0000-000000120302', '11111111-1111-1111-1111-111111111111', 'SYP', '1', '0', '0', '100000', '100000', 'خالد - دائن', '2017-01-31T00:00:00Z');

-- Entry 11: Payment to Supplier - سند دفع للمورد
-- Debit: المورد (220302) - 5,000 ل.س
-- Credit: الصندوق (1202) - 5,000 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0011', '11', 'CashPayment', 'PV-11', '2017-01-31T00:00:00Z', 'دفعة للمورد من الحساب', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0011-1', 'entry-0011', '00000000-0000-0000-0000-000000220302', '22222222-2222-2222-2222-222222222222', 'SYP', '1', '5000', '5000', '0', '0', 'شركة الشريف - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0011-2', 'entry-0011', '00000000-0000-0000-0000-000000001202', NULL, 'SYP', '1', '0', '0', '5000', '5000', 'الصندوق - دائن', '2017-01-31T00:00:00Z');

-- Entry 12: Another Receipt from Customer - سند قبض إضافي
-- Debit: الصندوق (1202) - 1,500 ل.س
-- Credit: العميل (120302) - 1,500 ل.س
INSERT INTO journal_entries (id, entry_number, journal_type, source_id, entry_date, description, status, created_at, posted_at, updated_at)
VALUES ('entry-0012', '12', 'CashReceipt', 'RV-12', '2017-01-31T00:00:00Z', 'دفعة على الحساب من العميل', 'Posted', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0012-1', 'entry-0012', '00000000-0000-0000-0000-000000001202', '11111111-1111-1111-1111-111111111111', 'SYP', '1', '1500', '1500', '0', '0', 'الصندوق - مدين', '2017-01-31T00:00:00Z');

INSERT INTO journal_lines (id, journal_entry_id, account_id, partner_id, currency, fx_rate, debit, debit_base, credit, credit_base, description, created_at)
VALUES ('line-0012-2', 'entry-0012', '00000000-0000-0000-0000-000000120302', '11111111-1111-1111-1111-111111111111', 'SYP', '1', '0', '0', '1500', '1500', 'خالد - دائن', '2017-01-31T00:00:00Z');