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
  currency?: string;
  exchange_rate?: string;
  purpose?: string;
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
  exchange_rate?: string;
  linked_customer_id?: string | null;
  linked_supplier_id?: string | null;
}

export interface AccountLedgerLineDto {
  date: string;
  journal_id: string;
  /** Canonical parent Journal Entry identity (same value as journal_id). */
  entry_id: string;
  entry_number: string;
  journal_type: string;
  /** Canonical machine tag (e.g. "account_opening_balance") — never parse types from text. */
  entry_type: string;
  entry_status: string;
  /** Final Movement Type label for display — render verbatim, never re-derive. */
  journal_type_display: string;
  /** Whether this line establishes an opening balance (backend-computed). */
  is_opening: boolean;
  line_id: string;
  account_id: string;
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

export interface OpeningEntryDto {
  entry_number: string;
  description: string;
  date: string;
  debit_base: string;
  credit_base: string;
}

export interface AccountLedgerDto {
  account_id: string;
  account_name: string;
  opening_balance_base: string;
  opening_balance_original: string;
  opening_entry?: OpeningEntryDto | null;
  opening_entries?: OpeningEntryDto[];
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
  CAPITAL: "00000000-0000-0000-0000-000000002202",
  CUSTOMERS: "00000000-0000-0000-0000-000000001230",
  SUPPLIERS: "00000000-0000-0000-0000-000000002230",
  FIXED_ASSET_BUILDINGS: "00000000-0000-0000-0000-000000001101",
  FIXED_ASSET_EQUIPMENT: "00000000-0000-0000-0000-000000001102",
  FIXED_ASSET_FURNITURE: "00000000-0000-0000-0000-000000001103",
  ACCUMULATED_DEPRECIATION_EQUIPMENT: "00000000-0000-0000-0000-000000001104",
  ACCUMULATED_DEPRECIATION_FURNITURE: "00000000-0000-0000-0000-000000001105",
  DEPRECIATION_EXPENSE_EQUIPMENT: "00000000-0000-0000-0000-000000004303",
  DEPRECIATION_EXPENSE_FURNITURE: "00000000-0000-0000-0000-000000004304",
  DEPRECIATION_EXPENSE: "00000000-0000-0000-0000-000000000046",
} as const;
