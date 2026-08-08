-- 146: Journal source idempotency
--
-- A financial event must map to exactly ONE journal entry: a re-submitted event
-- (double-click, network retry, replay) must never create a second journal. We
-- move that guarantee into the schema with a UNIQUE index over the
-- (source_type, source_id) pair. `source_type` identifies the originating
-- domain (capital_contribution, partner_drawing, ...) and `source_id` the
-- concrete event instance; see `JournalType::source_type()`.
--
-- Legacy rows written before this migration used per-partner keys, so a partner
-- with several contributions could share one source_id. To keep history intact
-- while still adding the index, every row belonging to a duplicate group is
-- re-keyed with its occurrence number (the earliest occurrence keeps the base
-- key); the unique index then applies to all future writes.

UPDATE journal_entries
SET source_id = (
    SELECT ranked.source_id || '_legacy:' || ranked.rn
    FROM (
        SELECT id, source_id,
               ROW_NUMBER() OVER (
                   PARTITION BY source_type, source_id
                   ORDER BY created_at ASC, id ASC
               ) rn
        FROM journal_entries
        WHERE source_type IS NOT NULL AND source_id IS NOT NULL
    ) ranked
    WHERE ranked.id = journal_entries.id
)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL
  AND (
    SELECT COUNT(*) FROM journal_entries je2
     WHERE je2.source_type IS journal_entries.source_type
       AND je2.source_id IS journal_entries.source_id
  ) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_source_unique
    ON journal_entries (source_type, source_id)
    WHERE source_type IS NOT NULL AND source_id IS NOT NULL;