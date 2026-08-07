-- Add company accounting-start mode used to decide whether partner capital
-- is a cash contribution (NewCompany) or opening equity for an existing
-- company migration (ExistingCompanyMigration).
ALTER TABLE settings ADD COLUMN accounting_start_mode TEXT NOT NULL DEFAULT 'NewCompany';