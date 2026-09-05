export type FiscalYearStatus =
  | 'Open'
  | 'Closing'
  | 'Closed'
  | 'Reopened'
  | 'Locked';

export interface FiscalYearCloseRunDto {
  operation_key: string;
  actor_id: string;
  status: string;
  closing_period_id: string | null;
  retained_earnings_entry_id: string | null;
  carry_forward_entry_id: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface FiscalYearDto {
  id: string;
  company_id: string | null;
  label: string;
  start_date: string;
  end_date: string;
  status: FiscalYearStatus;
  previous_fiscal_year_id: string | null;
  closing_period_id: string | null;
  retained_earnings_entry_id: string | null;
  carry_forward_entry_id: string | null;
  last_close_operation_key: string | null;
  closed_at: string | null;
  closed_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
  latest_close_run: FiscalYearCloseRunDto | null;
}

export interface CreateFiscalYearCommand {
  company_id?: string | null;
  label: string;
  start_date: string;
  end_date: string;
  previous_fiscal_year_id?: string | null;
}

export interface CloseFiscalYearCommand {
  fiscal_year_id: string;
  closing_period_id: string;
  operation_key: string;
  finalize: boolean;
  retained_earnings_entry_id?: string | null;
  carry_forward_entry_id?: string | null;
  context: { actor_id: string };
}

export interface ReopenFiscalYearCommand {
  fiscal_year_id: string;
  context: { actor_id: string };
}
