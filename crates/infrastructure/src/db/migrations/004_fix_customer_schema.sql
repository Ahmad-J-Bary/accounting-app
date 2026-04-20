-- Migration 004: Add balance and is_active columns to customers
-- These were missing from the initial schema but are required by the DTO and Repository

ALTER TABLE customers ADD COLUMN balance TEXT NOT NULL DEFAULT '0';
ALTER TABLE customers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
