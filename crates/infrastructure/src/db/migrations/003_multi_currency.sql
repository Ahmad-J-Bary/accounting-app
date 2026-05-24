-- Migration 003: Multi-currency support for Journal Entries
-- Adds currency and exchange rate fields to journal lines

ALTER TABLE journal_lines ADD COLUMN currency TEXT NOT NULL DEFAULT '';
ALTER TABLE journal_lines ADD COLUMN fx_rate TEXT NOT NULL DEFAULT '1.0';

ALTER TABLE journal_entries ADD COLUMN reversed_at TEXT;
