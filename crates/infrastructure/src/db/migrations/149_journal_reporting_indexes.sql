-- 149: Journal reporting & integrity indexes
--
-- The ledger is the authoritative financial source; reports (profit & loss,
-- balance sheet, opening position control) scan journal_lines joined through
-- journal_entries. These indexes cover the hot query paths so a growing
-- journal does not degrade the UI:
--
--   * (status, entry_date) — every filtered ledger / statement / controller
--     query posts _or_ groups by status first, then orders by entry_date.
--   * (account_id) — the join used by account-level trial balances, the
--     partner equity reports and the opening-position control buckets.
--   * (journal_entry_id) — the balance + lines read path for a single entry
--     (journal view, reversal pair load), and FK-friendly line deletes.

CREATE INDEX IF NOT EXISTS idx_journal_entries_status_entry_date
    ON journal_entries (status, entry_date);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id
    ON journal_lines (account_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_entry_id
    ON journal_lines (journal_entry_id);