-- 151: Atomicity & idempotency support indexes
--
-- Closes the remaining §45 schema gaps after the (source_type, source_id)
-- UNIQUE index from 146:
--
--   * idx_journal_entries_source_id      — every idempotency guard
--     (find_by_source_id / find_all_by_source_id) filters on source_id,
--     but no index exists for it (the 146 index has source_type as the
--     leftmost prefix, so those lookups could not use it and full-scanned).
--   * idx_journal_entries_source_type    — reversal-integrity cleanup and
--     any source-type reporting filter scan on this column.
--   * idx_journal_entries_journal_type   — the 142 cleanup and journal-type
--     filtered queries scan on this column.
--   * idx_journal_entries_reversal_of    — reversal-pair loads and the 142
--     dangling-reversal cleanup scan reversal_of_entry_id.
--   * idx_journal_lines_partner_id       — partner-ledger / equity-statement
--     queries group journal lines by partner.
--   * idx_journal_reversal_unique       — a true DB backstop for the
--     reversal idempotency guarantee. Generic Reversals carry source_id=NULL
--     (journal_entry.rs:279) and are therefore OUTSIDE the 146 partial
--     index, so nothing today stops two concurrent reverse requests that
--     both passed the application Posted check. Enforce at most one active
--     reversal target per original entry. Legacy rows that could already
--     carry duplicate reversal_of_entry_id are cleaned first (kept history
--     intact by dropping the stale overwrite, mirroring migration 142's
--     earlier scrub) so the unique index can be built.

-- Pre-clean: drop duplicate reversal links, keeping only the oldest linked
-- reversal; the unique index below then applies to all future writes.
UPDATE journal_entries
SET reversal_of_entry_id = NULL
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY reversal_of_entry_id
                   ORDER BY created_at ASC, id ASC
               ) rn
        FROM journal_entries
        WHERE reversal_of_entry_id IS NOT NULL
    )
    WHERE rn > 1
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_source_id
    ON journal_entries (source_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_source_type
    ON journal_entries (source_type);

CREATE INDEX IF NOT EXISTS idx_journal_entries_journal_type
    ON journal_entries (journal_type);

CREATE INDEX IF NOT EXISTS idx_journal_entries_reversal_of
    ON journal_entries (reversal_of_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_partner_id
    ON journal_lines (partner_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_reversal_unique
    ON journal_entries (reversal_of_entry_id)
    WHERE reversal_of_entry_id IS NOT NULL;