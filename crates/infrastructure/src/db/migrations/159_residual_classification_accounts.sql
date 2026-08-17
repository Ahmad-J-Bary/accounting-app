-- 159: Designated residual-classification accounts
--
-- Phase 4: the user chooses the ACCOUNTING MEANING of the opening residual and
-- the SYSTEM chooses the designated account — one controlled purpose per
-- classification, never an arbitrary balancing account. Retained earnings (52)
-- already exists; this migration ensures the three remaining designated detail
-- accounts under the equity group "5":
--
--   521  تعديل حقوق ملكية افتتاحي   purpose = opening_equity_adjustment
--   525  تعديل فترة سابقة           purpose = prior_period_adjustment
--   526  حقوق ملكية أخرى            purpose = other_equity
--
-- These are system-provided defaults (INSERT OR IGNORE), the same pattern used
-- for 52/53/54. Existing charts keep their accounts untouched. Level equals the
-- code length (521 → 3), matching the chart-hierarchy convention.

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000521', '521', 'تعديل حقوق ملكية افتتاحي', 'Opening Equity Adjustment', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Detail', 3, '0', '0', 'opening_equity_adjustment', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '521');

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000525', '525', 'تعديل فترة سابقة', 'Prior Period Adjustment', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Detail', 3, '0', '0', 'prior_period_adjustment', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '525');

INSERT OR IGNORE INTO accounts
(id, code, name_ar, name_en, account_type, parent_id, category, level, opening_balance, balance, purpose, is_active, created_at, updated_at)
SELECT '00000000-0000-0000-0000-000000000526', '526', 'حقوق ملكية أخرى', 'Other Equity', 'Equity', (SELECT id FROM accounts WHERE code = '5'), 'Detail', 3, '0', '0', 'other_equity', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '526');
