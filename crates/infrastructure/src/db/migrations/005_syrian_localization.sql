-- Migration 005: Default company name
-- Sets a default company name for new installations

UPDATE settings 
SET 
    company_name = 'شركة بردى للصناعة',
    updated_at = datetime('now')
WHERE id = 'default';
