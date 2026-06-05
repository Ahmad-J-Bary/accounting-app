-- Migration 112: Remove damaged item loss account (433) and legacy (5105)
-- First delete journal entries that have lines referencing account 433 or 5105
DELETE FROM journal_entries
WHERE id IN (
    SELECT DISTINCT journal_entry_id 
    FROM journal_lines 
    WHERE account_id IN (SELECT id FROM accounts WHERE code IN ('433', '5105'))
);

-- Delete the accounts
DELETE FROM accounts WHERE code IN ('433', '5105');
