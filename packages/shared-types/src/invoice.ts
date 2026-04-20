export interface InvoiceLineDto {
  product_id: string;
  quantity: string;
  unit_price: string;
}

export interface InvoiceDto {
  id: string;
  customer_id: string;
  lines: InvoiceLineDto[];
  issued_at: string;
  posted: boolean;
  total: string;
}

export interface CreateInvoiceRequest {
  customer_id: string;
  lines: InvoiceLineDto[];
}
