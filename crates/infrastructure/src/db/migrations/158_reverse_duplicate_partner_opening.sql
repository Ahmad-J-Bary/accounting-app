-- 158: Reverse duplicated per-entity partner/material opening journals.
--
-- Phase 3 defect (R1): the opening-balance migration's aggregate journal is the
-- single canonical GL owner of every Opening subledger (AR / AP / Inventory).
-- But when a customer / supplier / material-opening invoice is recorded while
-- `opening_window_active()` is false (the migration does not exist yet, or is
-- already sealed), the per-entity flow posts its OWN AccountOpeningBalance or
-- MaterialOpeningBalance journal (customer/create.rs, supplier/create.rs,
-- unified_invoice/post.rs). If the migration later derives the same entity
-- (wizard deriveAr/deriveAp/deriveInventoryRows -> migration items -> posted
-- migration lines), the SAME balance is booked twice in the GL:
--   once by the per-entity journal, once by the migration aggregate.
--
-- This migration inserts true Reversal journals (debit/credit swapped via the
-- same shape as `create_reversal` / `save_reversal_pair`) for every posted
-- per-entity opening journal whose balance is duplicated by a POSTED migration
-- aggregate journal, links each reversal via `reversal_of_entry_id`, and marks
-- the originals `Reversed` with `reversed_at`. Nothing is deleted: the audit
-- trail survives (original + reversal), and the migration aggregate keeps the
-- canonical GL position.
--
-- Idempotency: every reversal is guarded by the unique
-- `idx_journal_reversal_unique` (reversal_of_entry_id) and a recorded
-- (source_type, source_id); re-running the script on an already-fixed copy is
-- a no-op.
--
-- Criteria for a journal to be reversed:
--   * journal_type IN (AccountOpeningBalance, MaterialOpeningBalance)
--   * status = 'Posted', reversed_at IS NULL
--   * source is NOT a migration artifact (not `opening_balance:`,
--     `residual_classification:`, `ob_reversal:`) -> per-entity journal
--   * a POSTED migration aggregate journal (source_id `opening_balance:%`)
--     carries the SAME account with the SAME debit/credit amounts.

-- ---- Reverse the duplicated per-entity opening journals --------------------
INSERT INTO journal_entries
    (id, entry_number, journal_type, source_id, source_type, entry_date,
     description, status, created_at, posted_at, reversed_at, updated_at,
     reversal_of_entry_id, currency_code, exchange_rate)
SELECT
    '5f158000-0000-4000-8000-' || substr(dupe.id, 25)                     AS id,
    CAST(agg.max_no + ROW_NUMBER() OVER (ORDER BY dupe.entry_number) AS TEXT) AS entry_number,
    'Reversal'                                                           AS journal_type,
    'per_entity_opening_reversal:' || dupe.id                            AS source_id,
    'per_entity_opening_reversal'                                        AS source_type,
    dupe.entry_date                                                      AS entry_date,
    'عكس قيد ' || dupe.entry_number || ' — ' || dupe.description          AS description,
    'Posted'                                                             AS status,
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')                                AS created_at,
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')                                AS posted_at,
    NULL                                                                 AS reversed_at,
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')                                AS updated_at,
    dupe.id                                                              AS reversal_of_entry_id,
    dupe.currency_code                                                   AS currency_code,
    dupe.exchange_rate                                                   AS exchange_rate
FROM (
    SELECT DISTINCT je.id, je.entry_number, je.entry_date, je.description,
           je.currency_code, je.exchange_rate
      FROM journal_entries je
     WHERE je.status = 'Posted'
       AND je.reversed_at IS NULL
       AND je.journal_type IN ('AccountOpeningBalance', 'MaterialOpeningBalance')
       AND je.source_id IS NOT NULL
       AND je.source_id NOT LIKE 'opening_balance:%'
       AND je.source_id NOT LIKE 'residual_classification:%'
       AND je.source_id NOT LIKE 'ob_reversal:%'
       AND EXISTS (
           SELECT 1
             FROM journal_entries agg
             JOIN journal_lines agl ON agl.journal_entry_id = agg.id
            WHERE agg.source_id LIKE 'opening_balance:%'
              AND agg.status = 'Posted'
              AND EXISTS (
                  SELECT 1
                    FROM journal_lines jl
                   WHERE jl.journal_entry_id = je.id
                     AND jl.account_id = agl.account_id
                     AND jl.debit = agl.debit
                     AND jl.credit = agl.credit
              )
       )
       AND NOT EXISTS (
           SELECT 1 FROM journal_entries r
            WHERE r.reversal_of_entry_id = je.id
       )
) dupe
CROSS JOIN (
    SELECT COALESCE((SELECT MAX(CAST(entry_number AS INTEGER)) FROM journal_entries), 0) AS max_no
) agg;

-- ---- Reverse the lines of each duplicated journal (swap debit/credit) ------
INSERT INTO journal_lines
    (id, journal_entry_id, account_id, partner_id, currency, fx_rate,
     debit, debit_base, credit, credit_base, description, created_at)
SELECT
    '70000000-0000-4000-8000-' || substr(orig_line.id, 25)                  AS id,
    rev.id                                                                  AS journal_entry_id,
    orig_line.account_id                                                    AS account_id,
    orig_line.partner_id                                                    AS partner_id,
    orig_line.currency                                                      AS currency,
    orig_line.fx_rate                                                       AS fx_rate,
    orig_line.credit                                                        AS debit,
    orig_line.credit_base                                                   AS debit_base,
    orig_line.debit                                                         AS credit,
    orig_line.debit_base                                                    AS credit_base,
    'عكس قيد ' || orig.entry_number || ' — ' || orig_line.description       AS description,
    strftime('%Y-%m-%dT%H:%M:%SZ', 'now')                                   AS created_at
FROM journal_lines orig_line
JOIN journal_entries orig ON orig.id = orig_line.journal_entry_id
JOIN journal_entries rev ON rev.reversal_of_entry_id = orig.id
                        AND rev.journal_type = 'Reversal'
                        AND rev.source_type = 'per_entity_opening_reversal'
WHERE NOT EXISTS (
    SELECT 1 FROM journal_lines l2 WHERE l2.journal_entry_id = rev.id
);

-- ---- Mark the reversed originals ------------------------------------------
UPDATE journal_entries
   SET status = 'Reversed',
       reversed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
 WHERE id IN (
     SELECT r.reversal_of_entry_id
       FROM journal_entries r
      WHERE r.journal_type = 'Reversal'
        AND r.source_type = 'per_entity_opening_reversal'
 );