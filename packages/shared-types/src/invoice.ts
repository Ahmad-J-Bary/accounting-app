export interface InvoiceLineDto {
  material_id: string;
  material_name?: string;
  barcode?: string;
  code?: string;
  category_name?: string;
  quantity: string;
  unit_price: string;
  purchase_price?: string;
  retail_price?: string;
  wholesale_price?: string;
  semi_wholesale_price?: string;
  minimum_stock?: string;
  notes?: string;
}

export interface InvoiceDto {
  id: string;
  invoice_number: string;
  invoice_type: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  lines: InvoiceLineDto[];
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  payment_method: string;
  amount_paid: string;
  status: string;
  issued_at: string;
  notes?: string;
}

export interface CreateInvoiceRequest {
  invoice_number: string;
  invoice_type: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  lines: InvoiceLineDto[];
  tax_amount: string;
  discount_amount: string;
  payment_method: string;
  amount_paid: string;
  issued_at: string;
  notes?: string;
}

export interface UpdateInvoiceRequest {
  id: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  lines: InvoiceLineDto[];
  tax_amount: string;
  discount_amount: string;
  notes?: string;
}
