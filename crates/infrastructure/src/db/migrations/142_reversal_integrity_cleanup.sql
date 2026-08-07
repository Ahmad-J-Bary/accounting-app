-- Reversal integrity cleanup.
--
-- FK enforcement is disabled at the pool level (foreign_keys=false) for legacy
-- schema reasons, so a Reversal entry whose original was deleted would leave a
-- dangling reversal_of_entry_id. This migration scrubs such orphan rows:
--   * delete reversals (journal_type = 'Reversal') whose reversal_of_entry_id
--     does not point to an existing journal entry;
--   * reset rows that were marked 'Reversed' but whose matching reversal entry
--     no longer exists back to 'Posted' (their posted_at is preserved), so the
--     general ledger stays consistent with the actual reversals present.
-- Forward-only and idempotent.

DELETE FROM journal_entries
 WHERE journal_type = 'Reversal'
   AND (reversal_of_entry_id IS NULL
        OR reversal_of_entry_id NOT IN (SELECT id FROM journal_entries));

UPDATE journal_entries
   SET status = 'Posted', reversed_at = NULL, updated_at = datetime('now')
 WHERE status = 'Reversed'
   AND NOT EXISTS (
       SELECT 1 FROM journal_entries r
        WHERE r.journal_type = 'Reversal'
          AND r.reversal_of_entry_id = journal_entries.id
   );