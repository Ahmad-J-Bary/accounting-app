-- One-off data fix for purchase extra-costs journal entries.
--
-- Before this fix, the backend booked the credit side of the PurchaseCostsJournal
-- entry AND the debit side of the extra-costs CashPayment to account 41 (المشتريات).
-- Both must point to account 221 (تكاليف إضافية على المشتريات):
--   - PurchaseCostsJournal : Dr 41 / Cr 221  (extra costs added to purchases)
--   - CashPayment (extra)  : Dr 221 / Cr 122 (settles the 221 liability)
--
-- Run once against the app DB, e.g.:
--   sqlite3 "C:\Users\ahmad\AppData\Roaming\com.almowakeb.erp\erp.db" < scripts/fix-extra-costs-journal.sql
--
-- NOTE: statements are intentionally ASCII-only so they survive any shell encoding.
--       (Match by journal type / account codes / source linkage, not by Arabic text.)

-- 1. PurchaseCostsJournal: the credit ("allocation") line currently on 41 -> 221
UPDATE journal_lines
SET account_id = (SELECT id FROM accounts WHERE code = '221')
WHERE account_id = (SELECT id FROM accounts WHERE code = '41')
  AND credit > 0
  AND journal_entry_id IN (
    SELECT id FROM journal_entries WHERE journal_type = 'PurchaseCostsJournal'
  );

-- 2. Extra-costs CashPayment: the debit line currently on 41 -> 221.
--    The extra-costs CashPayment shares its source (invoice) with a
--    PurchaseCostsJournal entry; a regular supplier payment does not debit 41,
--    so the account check keeps this limited to the extra-costs payment.
UPDATE journal_lines
SET account_id = (SELECT id FROM accounts WHERE code = '221')
WHERE account_id = (SELECT id FROM accounts WHERE code = '41')
  AND debit > 0
  AND journal_entry_id IN (
    SELECT je.id
    FROM journal_entries je
    WHERE je.journal_type = 'CashPayment'
      AND je.source_id IN (
        SELECT DISTINCT source_id
        FROM journal_entries
        WHERE journal_type = 'PurchaseCostsJournal'
          AND source_id IS NOT NULL
      )
  );

-- 3. Standalone PurchaseCosts invoices (Dr 41 / Cr Cash): move the debit line to 221.
--    No-op when none exist.
UPDATE journal_lines
SET account_id = (SELECT id FROM accounts WHERE code = '221')
WHERE account_id = (SELECT id FROM accounts WHERE code = '41')
  AND debit > 0
  AND journal_entry_id IN (
    SELECT jl2.journal_entry_id
    FROM journal_lines jl2
    JOIN accounts a2 ON a2.id = jl2.account_id
    WHERE jl2.credit > 0
      AND a2.code = '122'
      AND jl2.journal_entry_id IN (
        SELECT id FROM journal_entries WHERE journal_type = 'PurchaseCostsJournal'
      )
  );
