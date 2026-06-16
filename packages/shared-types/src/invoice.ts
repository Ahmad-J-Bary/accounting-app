export interface MonetaryAmount {
  original_amount: string;
  original_currency: string;
  base_amount: string;
  fx_rate: string;
}

export interface InvoiceLineDto {
  id: string;
  material_id: string;
  material_name?: string;
  barcode?: string;
  code?: string;
  category_name?: string;
  quantity: string;
  unit_id?: string;
  unit_name?: string;
  conversion_factor?: string;
  unit_price: string;
  unit_price_v2?: MonetaryAmount;
  purchase_price?: string;
  purchase_price_v2?: MonetaryAmount;
  retail_price?: string;
  retail_price_v2?: MonetaryAmount;
  wholesale_price?: string;
  wholesale_price_v2?: MonetaryAmount;
  semi_wholesale_price?: string;
  semi_wholesale_price_v2?: MonetaryAmount;
  minimum_stock?: string;
  warehouse_id?: string;
  expiry_date?: string;
  notes?: string;
  unit_price_original?: string;
  purchase_price_original?: string;
  profit_amount_original?: string;
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
  tax_amount: string; // Keep string for backward compatibility or transition
  tax_amount_v2?: MonetaryAmount;
  discount_amount: string;
  discount_amount_v2?: MonetaryAmount;
  total_amount: string;
  total_amount_v2?: MonetaryAmount;
  payment_method: string;
  amount_paid: string;
  amount_paid_v2?: MonetaryAmount;
  status: string;
  issued_at: string;
  currency_code: string;
  exchange_rate: string;
  notes?: string;
  subtotal_amount: string;
  subtotal_amount_v2?: MonetaryAmount;
  extra_costs: string;
  extra_costs_v2?: MonetaryAmount;
  remaining_amount: string;
  remaining_amount_v2?: MonetaryAmount;
  total_profit?: string;
  profit_percent?: string;
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
  extra_costs?: string;
  payment_method: string;
  amount_paid: string;
  issued_at: string;
  currency_code: string;
  exchange_rate: string;
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
  extra_costs?: string;
  notes?: string;
}
