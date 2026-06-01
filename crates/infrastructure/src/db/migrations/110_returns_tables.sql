-- Migration 110: Sales Returns & Purchase Returns
CREATE TABLE IF NOT EXISTS sales_returns (
    id TEXT PRIMARY KEY,
    return_number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    return_date TEXT NOT NULL,
    total_amount TEXT NOT NULL DEFAULT '0',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS sales_return_lines (
    id TEXT PRIMARY KEY,
    sales_return_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit_price TEXT NOT NULL,
    unit_id TEXT,
    line_total TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE TABLE IF NOT EXISTS purchase_returns (
    id TEXT PRIMARY KEY,
    return_number TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL,
    return_date TEXT NOT NULL,
    total_amount TEXT NOT NULL DEFAULT '0',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
    id TEXT PRIMARY KEY,
    purchase_return_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit_price TEXT NOT NULL,
    unit_id TEXT,
    line_total TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id)
);
