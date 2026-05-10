export type PaymentType =
  | 'Receipt'
  | 'SupplierPayment'
  | 'ExpenseVoucher'
  | 'DrawingsVoucher'
  | 'CashIn'
  | 'CashOut'
  | 'Other';

export interface Payment {
  id: string;
  voucher_number: string;
  payment_type: PaymentType;
  amount: string;
  currency_code: string;
  exchange_rate: string;
  payment_date: string;
  debit_account_id?: string;
  credit_account_id?: string;
  journal_entry_number?: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface CreatePaymentRequest {
  voucher_number?: string;
  payment_type: PaymentType;
  amount: number;
  currency_code?: string;
  exchange_rate?: number;
  payment_date: string;
  debit_account_id?: string;
  credit_account_id?: string;
  customer_id?: string;
  supplier_id?: string;
  reference?: string;
  notes?: string;
}
