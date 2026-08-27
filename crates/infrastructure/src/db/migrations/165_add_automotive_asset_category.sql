-- Migration 165: Ensure the "آليات ومركبات" fixed-asset category exists
-- -----------------------------------------------------------------------------
-- The frontend auto-creates default categories only when asset_categories is
-- EMPTY. Databases that already hold the legacy three categories (أبنية وأراضي،
-- معدات وتجهيزات، أثاث ومفروشات) would never receive the new automotive
-- category, leaving fixed-asset creation for type "automotive" without a
-- matching category. Deterministic id keeps re-runs / environments consistent.
INSERT INTO asset_categories (id, name, asset_type)
SELECT '00000000-0000-0000-0000-00000000c101', 'آليات ومركبات', 'Fixed'
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE name = 'آليات ومركبات');
