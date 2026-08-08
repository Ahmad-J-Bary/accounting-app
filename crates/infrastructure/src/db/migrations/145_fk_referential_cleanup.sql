-- 145: Foreign-key referential cleanup
--
-- Historical migrations predate SQLite FK enforcement: several child tables were
-- written without validating their parent rows exist (journals, stock movements,
-- document lines, partner/shared accounts, etc.). Enabling `PRAGMA
-- foreign_keys = ON` at the pool level is safe only after purging the rows that
-- would now violate a constraint. This migration repairs every potentially
-- orphaned child row so the flip never rejects legitimate writes and the ledger
-- can finally rely on database-level integrity.

-- --- Journal audit tables (most critical) ---
-- A journal line must reference a real header and a real account.
DELETE FROM journal_lines
 WHERE NOT EXISTS (SELECT 1 FROM journal_entries WHERE journal_entries.id = journal_lines.journal_entry_id)
    OR NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.id = journal_lines.account_id);

-- Stock movements must reference a real material (`material_id`, originally
-- `product_id` before migration 022 renamed it and SQLite rewrote the FK).
DELETE FROM stock_movements
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = stock_movements.material_id);

-- --- Document line tables (referenced parents must survive) ---
DELETE FROM unified_invoice_lines
 WHERE NOT EXISTS (SELECT 1 FROM unified_invoices WHERE unified_invoices.id = unified_invoice_lines.invoice_id)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = unified_invoice_lines.material_id);

DELETE FROM sales_invoice_items
 WHERE NOT EXISTS (SELECT 1 FROM sales_invoices WHERE sales_invoices.id = sales_invoice_items.sales_invoice_id)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = sales_invoice_items.material_id);

DELETE FROM purchase_invoice_items
 WHERE NOT EXISTS (SELECT 1 FROM purchase_invoices WHERE purchase_invoices.id = purchase_invoice_items.purchase_invoice_id)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = purchase_invoice_items.material_id);

DELETE FROM purchase_invoice_additional_costs
 WHERE NOT EXISTS (SELECT 1 FROM purchase_invoices WHERE purchase_invoices.id = purchase_invoice_additional_costs.purchase_invoice_id)
    OR NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.id = purchase_invoice_additional_costs.account_id);

-- Sales / purchase returns: a line must reference a header and material.
DELETE FROM sales_return_lines
 WHERE NOT EXISTS (SELECT 1 FROM sales_returns WHERE sales_returns.id = sales_return_lines.sales_return_id)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = sales_return_lines.material_id);

DELETE FROM purchase_return_lines
 WHERE NOT EXISTS (SELECT 1 FROM purchase_returns WHERE purchase_returns.id = purchase_return_lines.purchase_return_id)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = purchase_return_lines.material_id);

-- Returns headers referencing a deleted customer/supplier are trimmed too, but
-- keep rows whose customer/supplier is NULL (unlinked cash return flows).
DELETE FROM sales_returns
 WHERE customer_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM customers WHERE customers.id = sales_returns.customer_id);

DELETE FROM purchase_returns
 WHERE supplier_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = purchase_returns.supplier_id);

-- Payments referencing a deleted customer/supplier (NULL is allowed: cash flows).
DELETE FROM payments
 WHERE (customer_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM customers WHERE customers.id = payments.customer_id))
    OR (supplier_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = payments.supplier_id));

-- Inventory adjustments / damaged items reference a material.
DELETE FROM stock_adjustments
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = stock_adjustments.material_id);

DELETE FROM damaged_items
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = damaged_items.material_id);

-- Material price cards need both material and unit parents.
DELETE FROM material_purchase_prices
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = material_purchase_prices.material_id)
    OR NOT EXISTS (SELECT 1 FROM material_units WHERE material_units.id = material_purchase_prices.unit_id);

DELETE FROM material_sale_prices
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = material_sale_prices.material_id)
    OR NOT EXISTS (SELECT 1 FROM material_units WHERE material_units.id = material_sale_prices.unit_id);

-- Material category links need both parents.
DELETE FROM material_categories
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = material_categories.material_id)
    OR NOT EXISTS (SELECT 1 FROM categories WHERE categories.id = material_categories.category_id);

-- Material units belong to a material. Before removing orphaned units, detach
-- any surviving material that still points at one as its default unit (the
-- FK is NO ACTION, so a dangling default would block the delete).
UPDATE materials
   SET default_purchase_unit_id = NULL
 WHERE default_purchase_unit_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM material_units
                   WHERE material_units.id = materials.default_purchase_unit_id
                     AND EXISTS (SELECT 1 FROM materials m2 WHERE m2.id = material_units.material_id));

UPDATE materials
   SET default_sale_unit_id = NULL
 WHERE default_sale_unit_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM material_units
                   WHERE material_units.id = materials.default_sale_unit_id
                     AND EXISTS (SELECT 1 FROM materials m2 WHERE m2.id = material_units.material_id));

DELETE FROM material_units
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = material_units.material_id);

-- Inventory lots: material and movement are mandatory parents; the purchase
-- invoice link is optional (SET NULL semantics).
DELETE FROM inventory_lots
 WHERE NOT EXISTS (SELECT 1 FROM materials WHERE materials.id = inventory_lots.material_id)
    OR NOT EXISTS (SELECT 1 FROM stock_movements WHERE stock_movements.id = inventory_lots.movement_id);

-- Partners' linked capital/drawings accounts must exist.
DELETE FROM partners
 WHERE (linked_account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.id = partners.linked_account_id))
    OR (drawings_account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM accounts WHERE accounts.id = partners.drawings_account_id));

-- Asset registry: fixed assets reference a category; depreciation schedules and
-- movements reference the asset. Child rows must be removed before the parent
-- (their FK is NO ACTION under SQLite's default deferred mode at DDL time; with
-- FK enforcement ON, deleting the parent while a child still points at it fails).
-- A schedule/movement is cleaned when its asset is gone *or* the asset itself
-- is doomed (its category is gone), so the later fixed_assets delete can't hit
-- a dangling child.
DELETE FROM depreciation_schedules
 WHERE NOT EXISTS (
     SELECT 1 FROM fixed_assets fa
     JOIN asset_categories ac ON ac.id = fa.category_id
      WHERE fa.id = depreciation_schedules.fixed_asset_id
 );

DELETE FROM asset_movements
 WHERE NOT EXISTS (
     SELECT 1 FROM fixed_assets fa
     JOIN asset_categories ac ON ac.id = fa.category_id
      WHERE fa.id = asset_movements.asset_id
 );

DELETE FROM fixed_assets
 WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE asset_categories.id = fixed_assets.category_id);

DELETE FROM consumables
 WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE asset_categories.id = consumables.category_id);

-- Opening-balance child tables must reference the migration they belong to.
DELETE FROM opening_balance_lines WHERE NOT EXISTS (SELECT 1 FROM opening_balance_migrations WHERE opening_balance_migrations.id = opening_balance_lines.migration_id);
DELETE FROM opening_balance_customer_items WHERE NOT EXISTS (SELECT 1 FROM opening_balance_migrations WHERE opening_balance_migrations.id = opening_balance_customer_items.migration_id);
DELETE FROM opening_balance_supplier_items WHERE NOT EXISTS (SELECT 1 FROM opening_balance_migrations WHERE opening_balance_migrations.id = opening_balance_supplier_items.migration_id);
DELETE FROM opening_balance_inventory_items WHERE NOT EXISTS (SELECT 1 FROM opening_balance_migrations WHERE opening_balance_migrations.id = opening_balance_inventory_items.migration_id);
DELETE FROM opening_balance_fixed_assets WHERE NOT EXISTS (SELECT 1 FROM opening_balance_migrations WHERE opening_balance_migrations.id = opening_balance_fixed_assets.migration_id);

-- Chart-of-accounts self-reference: an account whose parent is gone must be
-- re-rooted (parent_id = NULL) instead of deleted, since live ledger lines may
-- still reference it and deleting it would cascade away posted history.
UPDATE accounts
   SET parent_id = NULL, level = 1
 WHERE parent_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM accounts parent WHERE parent.id = accounts.parent_id);