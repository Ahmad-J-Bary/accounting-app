-- Remove email column from customers and suppliers
-- SQLite 3.35.0+ supports DROP COLUMN

ALTER TABLE customers DROP COLUMN email;
ALTER TABLE suppliers DROP COLUMN email;

-- We don't change phone/address nullability in DB to avoid complex migrations (SQLite limitation),
-- but we allow them to be empty strings from the application side.
