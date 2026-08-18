-- R1: Convert only the pristine/unconfigured company row to
-- ExistingCompanyMigration. The pristine row is the untouched seed inserted by
-- migration 002 (id='default') and renamed by migration 005 to its default
-- company name 'شركة بردى للصناعة'; it still carries the legacy default
-- 'NewCompany'. Any company whose name was customized is left untouched (no
-- data loss). New rows get EXISTING from the setup screen.
UPDATE settings
SET accounting_start_mode = 'ExistingCompanyMigration'
WHERE id = 'default'
  AND company_name = 'شركة بردى للصناعة'
  AND accounting_start_mode = 'NewCompany';