-- Migration 019: Fix Category ID to be a valid UUID
UPDATE categories SET id = '00000000-0000-0000-0000-000000000001' WHERE id = 'cat-general-default';
UPDATE material_categories SET category_id = '00000000-0000-0000-0000-000000000001' WHERE category_id = 'cat-general-default';
