-- 150: Fiscal periods (Sec 20 of the Accounting Domain Hardening)
--
-- A fiscal period is the reporting window a net-profit figure belongs to. It is
-- independent from the opening-balance cutover: the cutover records the
-- company's position at a single moment, the period is a span of accounting
-- dates. Only one period may be Closing/Closed at a time when closing is run,
-- and a closed period must not host new posting.
--
-- `company_id` stays NULL for the single-company deployment (the rest of the
-- schema has no companies table yet) so the table is forward-compatible.

CREATE TABLE IF NOT EXISTS fiscal_periods (
    id         TEXT PRIMARY KEY NOT NULL,
    company_id TEXT,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'Open',
    closed_at  TEXT,
    closed_by  TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates
    ON fiscal_periods (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_status
    ON fiscal_periods (status);