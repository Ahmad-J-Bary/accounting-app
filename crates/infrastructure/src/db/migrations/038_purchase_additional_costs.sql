-- Add table for purchase invoice additional costs
CREATE TABLE IF NOT EXISTS purchase_invoice_additional_costs (
    id TEXT PRIMARY KEY,
    purchase_invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    account_id TEXT NOT NULL,
    amount TEXT NOT NULL,
    FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);
