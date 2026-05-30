-- Migration 108: Remove obsolete sale price tiers
-- Deletes material_sale_prices with tier = 'consumer' or 'special'
DELETE FROM material_sale_prices WHERE tier IN ('consumer', 'special');
