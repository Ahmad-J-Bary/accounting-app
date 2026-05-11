-- Migration 048: Add debit and credit columns to accounts
ALTER TABLE accounts ADD COLUMN debit TEXT NOT NULL DEFAULT '0';
ALTER TABLE accounts ADD COLUMN credit TEXT NOT NULL DEFAULT '0';
