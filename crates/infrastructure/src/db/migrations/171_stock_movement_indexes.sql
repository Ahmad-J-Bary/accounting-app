-- 171: stock_movements performance indexes
--
-- The stock_movements table has no indexes beyond the PK, causing full table
-- scans on every query that filters by material_id. This is the single most
-- impactful missing index in the codebase.
--
-- Queries benefiting from idx_stock_movements_material_id:
--   * list_by_material       — WHERE material_id = ? ORDER BY movement_date DESC
--   * get_stock_balance      — delegates to list_by_material
--   * get_material_summary   — delegates to list_by_material
--   * list_detailed_by_material — WHERE sm.material_id = ? (8-LEFT-JOIN query)
--   * stock_adjustment existence checks per material
--
-- Queries NOT improved (by design):
--   * list_all               — no WHERE clause; full scan is the intended behavior
--   * list_by_reference      — OR across reference/document_number; no single index helps
--   * list_by_document_number — same OR pattern
--   * get_next_inventory_reference — GLOB filter is non-sargable
--   * DELETE by reference/document_number — same OR pattern; low frequency

-- Single-column index: covers all material_id lookups.
CREATE INDEX IF NOT EXISTS idx_stock_movements_material_id
    ON stock_movements (material_id);

-- Composite index: covers filter + sort for list_by_material (DESC).
-- Also benefits list_detailed_by_material for the material_id filter,
-- though SQLite will still filesort for the ASC+created_at ORDER BY.
CREATE INDEX IF NOT EXISTS idx_stock_movements_material_date
    ON stock_movements (material_id, movement_date);
