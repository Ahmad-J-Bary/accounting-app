-- 153: Fiscal-period permanent seal (Lock)
--
-- Adds the Lock lifecycle to fiscal_periods. A Locked period blocks posting
-- AND cannot be reopened through the normal flow (unlike Closed, which may be
-- reopened for corrections). locked_at/locked_by record the sealing action.

ALTER TABLE fiscal_periods ADD COLUMN locked_at TEXT;
ALTER TABLE fiscal_periods ADD COLUMN locked_by TEXT;
