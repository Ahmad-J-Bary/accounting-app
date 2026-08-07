-- Generic journal-entry reversal: contra-entry metadata.
-- Forward-only additions; safe to run on existing databases.

ALTER TABLE journal_entries ADD COLUMN source_type TEXT;
ALTER TABLE journal_entries ADD COLUMN reversal_of_entry_id TEXT;