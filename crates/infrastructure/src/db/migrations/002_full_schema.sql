-- Migration 002: Full ERP Schema
-- Adds all missing tables for the complete accounting ERP system

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    balance TEXT NOT NULL DEFAULT '0',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Sales invoices table (replaces/supplements generic invoices)
CREATE TABLE IF NOT EXISTS sales_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    subtotal TEXT NOT NULL DEFAULT '0',
    tax_amount TEXT NOT NULL DEFAULT '0',
    discount_amount TEXT NOT NULL DEFAULT '0',
    total TEXT NOT NULL DEFAULT '0',
    amount_paid TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'Draft',
    invoice_date TEXT NOT NULL,
    due_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Sales invoice items
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id TEXT PRIMARY KEY,
    sales_invoice_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit_price TEXT NOT NULL,
    line_total TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Purchase invoices table
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL,
    subtotal TEXT NOT NULL DEFAULT '0',
    tax_amount TEXT NOT NULL DEFAULT '0',
    discount_amount TEXT NOT NULL DEFAULT '0',
    total TEXT NOT NULL DEFAULT '0',
    amount_paid TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'Draft',
    invoice_date TEXT NOT NULL,
    due_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Purchase invoice items
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    id TEXT PRIMARY KEY,
    purchase_invoice_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    unit_price TEXT NOT NULL,
    line_total TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    payment_type TEXT NOT NULL,
    amount TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    customer_id TEXT,
    supplier_id TEXT,
    reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    movement_type TEXT NOT NULL,
    reason TEXT,
    reference TEXT,
    movement_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Damaged items table
CREATE TABLE IF NOT EXISTS damaged_items (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    quantity TEXT NOT NULL,
    reason TEXT NOT NULL,
    damage_date TEXT NOT NULL,
    cost_impact TEXT NOT NULL DEFAULT '0',
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Production orders table
CREATE TABLE IF NOT EXISTS production_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'Draft',
    production_date TEXT NOT NULL,
    notes TEXT,
    total_cost TEXT NOT NULL DEFAULT '0',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Production materials table
CREATE TABLE IF NOT EXISTS production_materials (
    id TEXT PRIMARY KEY,
    production_order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity_required TEXT NOT NULL,
    quantity_consumed TEXT NOT NULL DEFAULT '0',
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Production outputs table
CREATE TABLE IF NOT EXISTS production_outputs (
    id TEXT PRIMARY KEY,
    production_order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity_produced TEXT NOT NULL,
    unit_cost TEXT NOT NULL DEFAULT '0',
    FOREIGN KEY (production_order_id) REFERENCES production_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Stock adjustments table
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    system_quantity TEXT NOT NULL,
    actual_quantity TEXT NOT NULL,
    difference TEXT NOT NULL,
    reason TEXT,
    adjustment_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    permissions TEXT NOT NULL DEFAULT '[]',
    is_system_role BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    last_login TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    changes TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
);

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL DEFAULT 'شركتي',
    company_name_en TEXT,
    tax_number TEXT,
    commercial_register TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    currency TEXT NOT NULL DEFAULT 'SAR',
    currency_symbol TEXT NOT NULL DEFAULT 'ر.س',
    tax_rate TEXT NOT NULL DEFAULT '0',
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    purchase_prefix TEXT NOT NULL DEFAULT 'PUR',
    journal_prefix TEXT NOT NULL DEFAULT 'JE',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
    logo_path TEXT,
    updated_at TEXT NOT NULL
);

-- Insert default settings if not exists
INSERT OR IGNORE INTO settings (id, company_name, currency, currency_symbol, updated_at)
VALUES ('default', 'شركتي', 'SAR', 'ر.س', datetime('now'));

-- Insert default admin role if not exists
INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system_role, created_at, updated_at)
VALUES (
    'role-admin-default',
    'مدير النظام',
    'صلاحيات كاملة',
    '["Admin"]',
    1,
    datetime('now'),
    datetime('now')
);

-- Insert default admin user if not exists
INSERT OR IGNORE INTO users (id, username, full_name, password_hash, role_id, is_active, created_at, updated_at)
VALUES (
    'user-admin-default',
    'admin',
    'مدير النظام',
    'hashed:admin123',
    'role-admin-default',
    1,
    datetime('now'),
    datetime('now')
);

-- Add missing column to customers if not exists (for address)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, handle in code
