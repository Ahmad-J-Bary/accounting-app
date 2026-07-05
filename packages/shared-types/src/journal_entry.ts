export type JournalType = 
  | 'CashReceipt'
  | 'CashPayment'
  | 'ExpenseVoucher'
  | 'DrawingsVoucher'
  | 'CashOpeningBalance'
  | 'AccountOpeningBalance'
  | 'CashJournal'
  | 'CashSalesJournal'
  | 'CreditSalesJournal'
  | 'PurchaseJournal'
  | 'PurchaseCostsJournal'
  | 'MaterialOpeningBalance'
  | 'GeneralJournal'
  | 'SalesReturnJournal'
  | 'PurchaseReturnJournal'
  | 'SupplierReceiptJournal'
  | 'CustomerPaymentJournal'
  | 'DiscountEarnedJournal';

export interface JournalLineDto {
  account_id: string;
  account_code?: string;
  account_name?: string;
  partner_id?: string;
  currency: string;
  fx_rate: string;
  debit: string;
  credit: string;
  debit_base?: string;
  credit_base?: string;
  description: string;
}

export interface JournalEntryDto {
  id: string;
  entry_number: string;
  journal_type: JournalType;
  journal_type_display: string;
  source_id?: string;
  lines: JournalLineDto[];
  entry_date: string;
  description: string;
  status: string;
  total_base_debit: string;
  total_base_credit: string;
  created_at: string;
  updated_at: string;
}

export interface CreateJournalEntryRequest {
  entry_number: string;
  journal_type: JournalType;
  source_id?: string;
  lines: JournalLineDto[];
  entry_date: string;
  description: string;
}
