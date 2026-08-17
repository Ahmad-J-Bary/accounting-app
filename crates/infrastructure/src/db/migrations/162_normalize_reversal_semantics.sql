-- 162: Normalize journal entry semantics (Phase 2).
--
-- The accounting model separates three orthogonal attributes:
--   * journal_type  — the semantic business kind (e.g. AccountOpeningBalance),
--   * status        — lifecycle  (Draft / Posted / Reversed / Cancelled),
--   * reversal_of_entry_id — the REVERSAL RELATIONSHIP between two entries.
--
-- A reversal is a relationship, never a new accounting type. Earlier code
-- freely created `Reversal` / `OpeningBalanceReversal` journal types (manual
-- reversals, migration 158/161 auto-reversals, opening-balance cancel). Those
-- rows are normalized here:
--
--   1) Linked contra rows (`reversal_of_entry_id` set) have their journal_type
--      rewritten to the ORIGINAL's journal_type, so a contra is visibly a
--      reversal of the same business event, distinguishable only by the link.
--   2) Unlinked opening-balance cancel rows (`ob_reversal:` source, no link)
--      get the link back-filled to their `opening_balance:{id}` aggregate.
--   3) Originals whose contra now exists are marked `Reversed` (their
--      `reversed_at` is stamped), completing the pair. Nothing is deleted — the
--      audit trail is preserved.
--
-- Forward-only and idempotent: after the first run the affected rows no longer
-- match the WHERE clauses, so a re-run is a no-op.

-- ---- 1) Linked contra rows inherit the original's journal type -------------
UPDATE journal_entries
   SET journal_type = (
           SELECT orig.journal_type
             FROM journal_entries orig
            WHERE orig.id = journal_entries.reversal_of_entry_id
              AND orig.journal_type NOT IN ('Reversal', 'OpeningBalanceReversal')
       ),
       updated_at = datetime('now')
 WHERE journal_type IN ('Reversal', 'OpeningBalanceReversal')
   AND reversal_of_entry_id IS NOT NULL;

-- ---- 2) Back-fill the reversal relationship on opening-balance cancels -----
-- The ob_reversal row's id is derived from the migration id it cancels, which
-- is also the suffix of the aggregate's `opening_balance:{id}` source.
UPDATE journal_entries
   SET reversal_of_entry_id = (
           SELECT orig.id
             FROM journal_entries orig
            WHERE orig.source_id =
                  'opening_balance:' || substr(journal_entries.source_id,
                                               length('ob_reversal:') + 1)
       ),
       journal_type = (
           SELECT orig.journal_type
             FROM journal_entries orig
            WHERE orig.source_id =
                  'opening_balance:' || substr(journal_entries.source_id,
                                               length('ob_reversal:') + 1)
       ),
       updated_at = datetime('now')
 WHERE journal_type = 'OpeningBalanceReversal'
   AND reversal_of_entry_id IS NULL
   AND source_id LIKE 'ob_reversal:%'
   AND EXISTS (
       SELECT 1
         FROM journal_entries orig
        WHERE orig.source_id =
              'opening_balance:' || substr(journal_entries.source_id,
                                           length('ob_reversal:') + 1)
   );

-- ---- 3) Mark the reversed originals ----------------------------------------
UPDATE journal_entries
   SET status = 'Reversed',
       reversed_at = datetime('now'),
       updated_at = datetime('now')
 WHERE status = 'Posted'
   AND EXISTS (
       SELECT 1
         FROM journal_entries r
        WHERE r.source_id =
              'ob_reversal:' || substr(journal_entries.source_id,
                                       length('opening_balance:') + 1)
          AND r.reversal_of_entry_id = journal_entries.id
   );