export interface InvoiceLineDto {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export interface InvoiceDto {
  id: string;
  invoice_number: string;
  customer_id: string;
  lines: InvoiceLineDto[];
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  issued_at: string;
  posted: boolean;
}

export interface CreateInvoiceRequest {
  invoice_number: string;
  customer_id: string;
  lines: InvoiceLineDto[];
  tax_amount: string;
  discount_amount: string;
}
