-- Migration 009: Add Damaged Items Loss Account
-- Expense account (5105) - خسائر المواد التالفة

INSERT OR IGNORE INTO accounts (id, code, name_ar, name_en, account_type, parent_id, balance, is_active, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000005105',
    '5105',
    'خسائر المواد التالفة',
    'Loss from Damaged Items',
    'Expenses',
    NULL,
    '0',
    1,
    datetime('now'),
    datetime('now')
);
