ALTER TABLE accounts ADD COLUMN currency_code TEXT DEFAULT 'USD';
ALTER TABLE accounts ADD COLUMN exchange_rate TEXT DEFAULT '1';
