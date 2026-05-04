-- Migration 033: Currency metadata and exchange-rate performance indexes

ALTER TABLE currencies ADD COLUMN notes TEXT;

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_date
  ON exchange_rates(from_currency, to_currency, rate_date DESC);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_type_date
  ON exchange_rates(from_currency, to_currency, rate_type, rate_date DESC);
