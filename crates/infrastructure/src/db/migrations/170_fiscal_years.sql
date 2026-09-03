-- 170: Fiscal-year foundation
--
-- Adds an explicit fiscal_years aggregate and an auditable/idempotent close-run
-- log. This does NOT rewrite existing fiscal periods; it gives the backend a
-- safe foundation for atomic year closing, retained-earnings transfer, and
-- carry-forward orchestration in later phases.

CREATE TABLE IF NOT EXISTS fiscal_years (
    id                         TEXT PRIMARY KEY NOT NULL,
    company_id                 TEXT,
    label                      TEXT NOT NULL,
    start_date                 TEXT NOT NULL,
    end_date                   TEXT NOT NULL,
    status                     TEXT NOT NULL DEFAULT 'Open',
    previous_fiscal_year_id    TEXT,
    closing_period_id          TEXT,
    retained_earnings_entry_id TEXT,
    carry_forward_entry_id     TEXT,
    last_close_operation_key   TEXT,
    closed_at                  TEXT,
    closed_by                  TEXT,
    locked_at                  TEXT,
    locked_by                  TEXT,
    created_at                 TEXT NOT NULL,
    updated_at                 TEXT NOT NULL,
    FOREIGN KEY (previous_fiscal_year_id) REFERENCES fiscal_years(id),
    FOREIGN KEY (closing_period_id) REFERENCES fiscal_periods(id),
    FOREIGN KEY (retained_earnings_entry_id) REFERENCES journal_entries(id),
    FOREIGN KEY (carry_forward_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_years_company_dates
    ON fiscal_years (company_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_fiscal_years_status
    ON fiscal_years (status);

CREATE TABLE IF NOT EXISTS fiscal_year_close_runs (
    fiscal_year_id              TEXT NOT NULL,
    operation_key               TEXT NOT NULL,
    actor_id                    TEXT NOT NULL,
    status                      TEXT NOT NULL DEFAULT 'Started',
    closing_period_id           TEXT,
    retained_earnings_entry_id  TEXT,
    carry_forward_entry_id      TEXT,
    error_message               TEXT,
    started_at                  TEXT NOT NULL,
    completed_at                TEXT,
    updated_at                  TEXT NOT NULL,
    PRIMARY KEY (fiscal_year_id, operation_key),
    FOREIGN KEY (fiscal_year_id) REFERENCES fiscal_years(id),
    FOREIGN KEY (closing_period_id) REFERENCES fiscal_periods(id),
    FOREIGN KEY (retained_earnings_entry_id) REFERENCES journal_entries(id),
    FOREIGN KEY (carry_forward_entry_id) REFERENCES journal_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_year_close_runs_status
    ON fiscal_year_close_runs (status);
