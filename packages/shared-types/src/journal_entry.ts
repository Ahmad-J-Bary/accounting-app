export type JournalType = 
  | 'CashReceipt'
  | 'CashPayment'
  | 'CashOpeningBalance'
  | 'AccountOpeningBalance'
  | 'CashJournal'
  | 'CashSalesJournal'
  | 'CreditSalesJournal'
  | 'PurchaseJournal'
  | 'PurchaseCostsJournal'
  | 'MaterialOpeningBalance'
  | 'GeneralJournal';

export interface JournalLineDto {
  account_id: string;
  account_name?: string;
  partner_id?: string;
  partner_name?: string;
  currency: string;
  fx_rate: string;
  debit: string;
  credit: string;
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

