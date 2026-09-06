export interface TrialBalanceLineDto {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  debit_total: string;
  credit_total: string;
  balance: string;
}

export interface TrialBalanceDto {
  lines: TrialBalanceLineDto[];
  total_debit: string;
  total_credit: string;
  generated_at: string;
}

export interface ProfitLossLineDto {
  account_name: string;
  amount: string;
}

export interface ProfitLossDto {
  revenue_lines: ProfitLossLineDto[];
  expense_lines: ProfitLossLineDto[];
  total_revenue: string;
  total_expenses: string;
  net_profit: string;
  period_start: string;
  period_end: string;
}

export interface BalanceSheetDto {
  assets: ProfitLossLineDto[];
  liabilities: ProfitLossLineDto[];
  equity: ProfitLossLineDto[];
  total_assets: string;
  total_liabilities: string;
  total_equity: string;
  as_of_date: string;
}
