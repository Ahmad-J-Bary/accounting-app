-- Migration 035: Enhanced Journal Schema
-- Adds journal_type, source_id to journal_entries and partner_id to journal_lines

ALTER TABLE journal_entries ADD COLUMN journal_type TEXT NOT NULL DEFAULT 'GeneralJournal';
ALTER TABLE journal_entries ADD COLUMN source_id TEXT;

ALTER TABLE journal_lines ADD COLUMN partner_id TEXT;
