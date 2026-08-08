-- 144: Opening residual reclassification state
-- Tracks whether a posted opening-balance migration has had its residual
-- (the Opening Balance Equity 53 balance) moved into the accountant-chosen
-- classification account via an explicit journal (Sec 6 / Sec 8 / Sec 15).
-- The lock gate requires the control balance to be zero, which happens only
-- after this reclassification has been applied (or the accountant balanced the
-- lines without any residual).
ALTER TABLE opening_balance_migrations ADD COLUMN residual_applied_at TEXT NULL;