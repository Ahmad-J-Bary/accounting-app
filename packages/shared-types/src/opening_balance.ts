export interface PositionAccountLine {
  account_id: string;
  code: string;
  name_ar: string;
  purpose: string;
  group_key: string;
  amount: string;
}

export interface PositionPartnerRow {
  partner_id: string;
  partner_name: string;
  capital: string;
  ownership_percent: string;
  current: string;
  drawings: string;
  net_equity: string;
}

export interface OpeningPositionControlDto {
  total_assets: string;
  total_liabilities: string;
  net_assets: string;

  partner_capital: string;
  partner_current_accounts: string;
  retained_earnings: string;
  opening_equity_adjustment: string;
  other_equity: string;
  drawings: string;
  total_equity: string;

  equity_difference: string;
  is_balanced: boolean;
  opening_historical_result: string;

  classification: string | null;
  residual_applied: boolean;
  difference_message: string | null;

  asset_detail: PositionAccountLine[];
  liability_detail: PositionAccountLine[];
  equity_detail: PositionAccountLine[];
  partner_rows: PositionPartnerRow[];
}