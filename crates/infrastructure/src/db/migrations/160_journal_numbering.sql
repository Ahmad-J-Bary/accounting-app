-- 160: Journal entry number sequence.
--
-- The legacy allocator read MAX(entry_number) + 1 outside any transaction,
-- so two concurrent journal-creation flows could derive the same number and
-- collide on the UNIQUE entry_number constraint. This table is a real
-- sequence: get_next_entry_number seeds it once from the current MAX, then
-- persists every allocation (increment within a transaction), so each caller
-- is guaranteed a globally unique number.

CREATE TABLE IF NOT EXISTS journal_numbering (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    next_value INTEGER NOT NULL
);

INSERT OR IGNORE INTO journal_numbering (id, next_value)
VALUES (1, COALESCE((SELECT MAX(CAST(entry_number AS INTEGER)) FROM journal_entries), 0) + 1);