export interface PurchaseInvoiceItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  notes?: string;
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_id: string;
  supplier_name?: string;
  items: PurchaseInvoiceItem[];
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  amount_paid: string;
  remaining_amount: string;
  status: 'Draft' | 'Posted' | 'Cancelled' | 'Paid' | 'PartiallyPaid';
  invoice_date: string;
  due_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePurchaseInvoiceItemRequest {
  product_id: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

export interface CreatePurchaseInvoiceRequest {
  invoice_number: string;
  supplier_id?: string;
  supplier_name?: string;
  items: CreatePurchaseInvoiceItemRequest[];
  tax_amount?: number;
  discount_amount?: number;
  payment_method: "Cash" | "Deferred" | "Partial";
  amount_paid: string;
  invoice_date: string;
  due_date?: string;
  notes?: string;
}
