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
  is_default: boolean;
  is_final: boolean;
  linked_customer_id: string | null;
  linked_supplier_id: string | null;
  debit: string;
  credit: string;
}

export interface SaveAccountCommand {
  code: string;
  name_ar: string;
  name_en: string;
  account_type: string;
  parent_id: string | null;
  category: string;
  level: number;
  opening_balance: string;
  notes: string | null;
  is_default?: boolean;
  is_active?: boolean;
  debit?: string;
  credit?: string;
  currency?: string;
  linked_customer_id?: string | null;
  linked_supplier_id?: string | null;
}

export interface AccountLedgerLineDto {
  date: string;
  journal_id: string;
  entry_number: string;
  journal_type: string;
  source_id: string | null;
  description: string;
  opposite_account_name: string;
  currency: string;
  fx_rate: string;
  debit_base: string;
  credit_base: string;
  balance_base: string;
  debit_original: string;
  credit_original: string;
  balance_original: string;
}

export interface AccountLedgerDto {
  account_id: string;
  account_name: string;
  opening_balance_base: string;
  opening_balance_original: string;
  lines: AccountLedgerLineDto[];
  total_debit_base: string;
  total_credit_base: string;
  closing_balance_base: string;
  total_debit_original: string;
  total_credit_original: string;
  closing_balance_original: string;
}

export interface ReceivablesPayablesSummary {
  total_receivables: string;
  total_payables: string;
  net_position: string;
  customers_debit: string;
  customers_credit: string;
  suppliers_debit: string;
  suppliers_credit: string;
  unlinked_customers: number;
  unlinked_suppliers: number;
}

export const SYSTEM_ACCOUNT_IDS = {
  OTHER_EXPENSES: "00000000-0000-0000-0000-000000000043",
  DRAWINGS: "00000000-0000-0000-0000-000000000044",
  CASH: "00000000-0000-0000-0000-000000001202",
  CUSTOMERS: "00000000-0000-0000-0000-000000001230",
  SUPPLIERS: "00000000-0000-0000-0000-000000002230",
} as const;
