-- Migration 022: Rename product_id columns to material_id in related tables
-- Migration 018 renamed the products table to materials but didn't update foreign key column names

-- SQLite doesn't support ALTER TABLE RENAME COLUMN before version 3.25.0
-- We use the newer RENAME COLUMN syntax which should work with recent SQLite versions

ALTER TABLE invoice_lines RENAME COLUMN product_id TO material_id;
ALTER TABLE sales_invoice_items RENAME COLUMN product_id TO material_id;
ALTER TABLE purchase_invoice_items RENAME COLUMN product_id TO material_id;
ALTER TABLE stock_movements RENAME COLUMN product_id TO material_id;
ALTER TABLE stock_adjustments RENAME COLUMN product_id TO material_id;
ALTER TABLE damaged_items RENAME COLUMN product_id TO material_id;
ALTER TABLE production_materials RENAME COLUMN product_id TO material_id;
ALTER TABLE production_outputs RENAME COLUMN product_id TO material_id;
