export interface SalesReturnLineDto {
  id: string;
  material_id: string;
  material_name?: string;
  quantity: string;
  unit_price: string;
  unit_id?: string;
  line_total: string;
  notes?: string;
  invoice_line_id?: string;
}

export interface SalesReturnDto {
  id: string;
  return_number: string;
  customer_id: string;
  customer_name?: string;
  return_date: string;
  lines: SalesReturnLineDto[];
  total_amount: string;
  notes?: string;
  created_at: string;
}

export interface CreateSalesReturnRequest {
  id?: string;
  return_number: string;
  customer_id: string;
  customer_name?: string;
  return_date: string;
  lines: SalesReturnLineDto[];
  notes?: string;
  settlement_mode?: string;
  settlement_amount?: string;
}

export interface PurchaseReturnLineDto {
  id: string;
  material_id: string;
  material_name?: string;
  quantity: string;
  unit_price: string;
  unit_id?: string;
  line_total: string;
  notes?: string;
  invoice_line_id?: string;
}

export interface PurchaseReturnDto {
  id: string;
  return_number: string;
  supplier_id: string;
  supplier_name?: string;
  return_date: string;
  lines: PurchaseReturnLineDto[];
  total_amount: string;
  notes?: string;
  created_at: string;
}

export interface CreatePurchaseReturnRequest {
  id?: string;
  return_number: string;
  supplier_id: string;
  supplier_name?: string;
  return_date: string;
  lines: PurchaseReturnLineDto[];
  notes?: string;
  settlement_mode?: string;
  settlement_amount?: string;
}
