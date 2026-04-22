export interface JournalLineDto {
  account_id: string;
  currency: string;
  fx_rate: string;
  debit: string;
  credit: string;
  description: string;
}

export interface JournalEntryDto {
  id: string;
  entry_number: string;
  lines: JournalLineDto[];
  entry_date: string;
  description: string;
  status: string;
  total_base_debit: string;
  total_base_credit: string;
}

export interface CreateJournalEntryRequest {
  entry_number: string;
  lines: JournalLineDto[];
  entry_date: string;
  description: string;
}
