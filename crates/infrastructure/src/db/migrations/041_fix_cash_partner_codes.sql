-- Migration 041: Update Cash Partner Codes to end with 0
-- Goals:
-- 1) Change زبون نقدي from 1231 to 1230
-- 2) Change مورد نقدي from 2231 to 2230

UPDATE accounts SET code = '1230' WHERE code = '1231' AND name_ar LIKE '%نقدي%';
UPDATE accounts SET code = '2230' WHERE code = '2231' AND name_ar LIKE '%نقدي%';
