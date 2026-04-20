-- Migration 003: Add address column to customers
-- SQLite doesn't support IF NOT EXISTS for ADD COLUMN directly in some versions, 
-- but SQLx migrations will handle this as a one-time execution.

ALTER TABLE customers ADD COLUMN address TEXT;
