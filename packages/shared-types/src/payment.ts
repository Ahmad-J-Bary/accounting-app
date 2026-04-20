export type PaymentType = 'Receipt' | 'SupplierPayment' | 'CashIn' | 'CashOut' | 'Other';

export interface Payment {
  id: string;
  payment_type: PaymentType;
  amount: string;
  payment_date: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface CreatePaymentRequest {
  payment_type: PaymentType;
  amount: number;
  payment_date: string;
  customer_id?: string;
  supplier_id?: string;
  reference?: string;
  notes?: string;
}
