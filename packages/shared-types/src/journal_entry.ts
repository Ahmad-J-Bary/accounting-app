export interface JournalLineDto {
  account_id: string;
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
  total_debit: string;
  total_credit: string;
}

export interface CreateJournalEntryRequest {
  entry_number: string;
  lines: JournalLineDto[];
  entry_date: string;
  description: string;
}
