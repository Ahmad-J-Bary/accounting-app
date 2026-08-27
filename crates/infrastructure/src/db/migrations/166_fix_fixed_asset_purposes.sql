-- 166: Backfill account purpose for fixed asset accounts
--
-- Migration 164 inserted account 112 ("آليات ومركبات") without the `purpose` column,
-- leaving it NULL (mapped to General by the mapper). The reconciliation's
-- `gl_bucket_totals` only classifies accounts with purpose=FixedAsset, so the
-- opening line for this account was silently skipped → GL=50 while
-- subledger=200 (both assets counted). Backfill all fixed-asset-range accounts
-- that are still missing the correct purpose.

UPDATE accounts
SET purpose = 'fixed_asset', updated_at = datetime('now')
WHERE code LIKE '11%'
  AND account_type = 'Assets'
  AND (purpose IS NULL OR purpose = 'general');
