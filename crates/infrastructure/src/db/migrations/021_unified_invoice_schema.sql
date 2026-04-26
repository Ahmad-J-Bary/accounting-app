-- Migration 021: Unified Invoices
-- Supports Sales, Purchase, and Opening Balance invoices with detailed lines

CREATE TABLE IF NOT EXISTS unified_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_type TEXT NOT NULL, -- 'Sales', 'Purchase', 'OpeningBalance'
    customer_id TEXT,
    supplier_id TEXT,
    tax_amount TEXT NOT NULL DEFAULT '0',
    discount_amount TEXT NOT NULL DEFAULT '0',
    total_amount TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'Draft',
    issued_at TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS unified_invoice_lines (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit_price TEXT NOT NULL,
    purchase_price TEXT,
    retail_price TEXT,
    wholesale_price TEXT,
    semi_wholesale_price TEXT,
    minimum_stock TEXT,
    notes TEXT,
    FOREIGN KEY (invoice_id) REFERENCES unified_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
);
