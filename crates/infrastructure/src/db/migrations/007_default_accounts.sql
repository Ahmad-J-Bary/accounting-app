-- Migration 007: Ensure Default Accounts for Opening Stock Journal Entries
-- Adds the inventory asset account (1201) and opening balance equity account (224)
-- if they don't already exist, so that RecordOpeningStockUseCase can always find them.

-- Inventory account (Asset) - مخزون البضاعة
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000001201',
    '1201',
    'مخزون البضاعة',
    'Inventory',
    'Assets',
    NULL,
    '0',
    1,
    datetime('now'),
    datetime('now')
);

-- Opening Balance Equity account - رصيد افتتاحي (تحت الخصوم المتداولة)
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000003002',
    '224',
    'رصيد افتتاحي',
    'Opening Balance Equity',
    'Equity',
    (SELECT id FROM accounts WHERE code = '22' LIMIT 1),
    '0',
    1,
    datetime('now'),
    datetime('now')
);

-- Accounts Receivable (1301) - ذمم مدينة
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000001301',
    '1301',
    'ذمم مدينة - عملاء',
    'Accounts Receivable',
    'Assets',
    NULL,
    '0',
    1,
    datetime('now'),
    datetime('now')
);

-- Accounts Payable (2101) - ذمم دائنة
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000002101',
    '2101',
    'ذمم دائنة - موردون',
    'Accounts Payable',
    'Liabilities',
    NULL,
    '0',
    1,
    datetime('now'),
    datetime('now')
);

-- Sales Revenue (4001) - إيرادات المبيعات
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000004001',
    '4001',
    'إيرادات المبيعات',
    'Sales Revenue',
    'Revenue',
    NULL,
    '0',
    1,
    datetime('now'),
    datetime('now')
);

-- Cost of Goods Sold (5001) - تكلفة البضاعة المباعة
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000005001',
    '5001',
    'تكلفة البضاعة المباعة',
    'Cost of Goods Sold',
    'Expenses',
    NULL,
    '0',
    1,
    datetime('now'),
    datetime('now')
);

-- Cash (1101) - الصندوق / النقدية
INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000001101',
    '1101',
    'الصندوق',
    'Cash',
    'Assets',
    NULL,
    '0',
    1,
    datetime('now'),
    datetime('now')
);
