-- Migration 143
-- 1) Partner drawings are a contra-equity (owner equity) balance, NOT an
--    operating expense. Reclassify the chart "44 مسحوبات/Withdrawals" subtree
--    from Expenses -> Equity so drawings never appear as a P&L expense
--    (spec Sec 11 / Sec 31 / Sec 40).
-- 2) Opening-balance migration: support an explicit residual-equity
--    classification and its target ledger account (Sec 6 / Sec 8). The
--    classification is approved by the accountant, never auto-fitted.

UPDATE accounts
SET account_type = 'Equity',
    name_ar = CASE WHEN code = '44' THEN 'مسحوبات الشركاء' ELSE name_ar END,
    name_en = CASE WHEN code = '44' THEN 'Partner Drawings' ELSE name_en END,
    updated_at = datetime('now')
WHERE account_type = 'Expenses' AND code LIKE '44%';

ALTER TABLE opening_balance_migrations ADD COLUMN residual_classification TEXT;
ALTER TABLE opening_balance_migrations ADD COLUMN residual_account_id TEXT;