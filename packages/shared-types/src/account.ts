export interface AccountDto {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  account_type: string;
  parent_id: string | null;
  category: string;
  level: number;
  opening_balance: string;
  balance: string;
  notes: string | null;
  is_active: boolean;
}

export interface AccountLedgerLineDto {
  date: string;
  journal_id: string;
  description: string;
  currency: string;
  fx_rate: string;
  debit: string;
  credit: string;
  base_debit: string;
  base_credit: string;
  running_balance: string;
}

export interface AccountLedgerDto {
  account_id: string;
  account_name: string;
  lines: AccountLedgerLineDto[];
  total_debit: string;
  total_credit: string;
  final_balance: string;
}
