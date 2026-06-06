-- Add costing_method to materials (Average | FIFO)
ALTER TABLE materials ADD COLUMN costing_method TEXT NOT NULL DEFAULT 'Average';

-- Inventory lots table for FIFO costing
CREATE TABLE IF NOT EXISTS inventory_lots (
    id TEXT PRIMARY KEY NOT NULL,
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    purchase_invoice_id TEXT REFERENCES unified_invoices(id) ON DELETE SET NULL,
    movement_id TEXT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
    quantity_original TEXT NOT NULL DEFAULT '0',
    quantity_remaining TEXT NOT NULL DEFAULT '0',
    unit_cost_base TEXT NOT NULL DEFAULT '0',
    raw_unit_cost_base TEXT NOT NULL DEFAULT '0',
    currency_code TEXT,
    fx_rate TEXT NOT NULL DEFAULT '1',
    purchase_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_material_id ON inventory_lots(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_movement_id ON inventory_lots(movement_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_purchase_date ON inventory_lots(purchase_date);
