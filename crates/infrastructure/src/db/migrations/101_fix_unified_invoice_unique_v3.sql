PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS unified_invoices_new (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    invoice_type TEXT NOT NULL,
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
    payment_method TEXT NOT NULL DEFAULT 'Deferred',
    amount_paid TEXT NOT NULL DEFAULT '0',
    customer_name TEXT,
    supplier_name TEXT,
    total_amount_base TEXT NOT NULL DEFAULT '0',
    amount_paid_base TEXT NOT NULL DEFAULT '0',
    tax_amount_base TEXT NOT NULL DEFAULT '0',
    discount_amount_base TEXT NOT NULL DEFAULT '0',
    currency_code TEXT DEFAULT 'USD',
    exchange_rate TEXT DEFAULT '1.0',
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    UNIQUE(invoice_number, invoice_type)
);

INSERT INTO unified_invoices_new SELECT 
    id, invoice_number, invoice_type, customer_id, supplier_id, tax_amount, discount_amount, total_amount, status, issued_at, notes, created_at, updated_at, payment_method, amount_paid, customer_name, supplier_name, total_amount_base, amount_paid_base, tax_amount_base, discount_amount_base, currency_code, exchange_rate 
FROM unified_invoices;

DROP TABLE unified_invoices;
ALTER TABLE unified_invoices_new RENAME TO unified_invoices;

PRAGMA foreign_keys=on;
