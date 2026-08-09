export type FiscalPeriodStatus = 'Open' | 'Closing' | 'Closed' | 'Reopened' | 'Cancelled';

export interface FiscalPeriodDto {
  id: string;
  company_id: string | null;
  start_date: string;
  end_date: string;
  status: FiscalPeriodStatus;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFiscalPeriodCommand {
  company_id?: string | null;
  start_date: string;
  end_date: string;
}

export interface CloseFiscalPeriodCommand {
  period_id: string;
  closed_by: string;
  finalize: boolean;
}

export interface ComputePeriodProfitCommand {
  company_id?: string | null;
  period_start: string;
  period_end: string;
}

export interface ComputedPeriodProfitDto {
  net_profit: string;
  total_revenue: string;
  total_expenses: string;
  entry_count: number;
}

export interface DistributableProfitDto {
  period_id: string | null;
  current_period_profit: string;
  retained_earnings_balance: string;
  allocated_to_date: string;
  distributable: string;
}