export interface Currency {
  code: string;
  name: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
  is_base: boolean;
  is_active: boolean;
  notes?: string | null;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: string;
  rate_type: string;
  rate_date: string;
  source: string | null;
}

export interface TodayRateStatus {
  currency_code: string;
  currency_name_ar: string;
  currency_name_en: string;
  currency_symbol: string;
  has_rate_today: boolean;
  rate: string | null;
  rate_type: string | null;
  last_rate: string | null;
  last_rate_date: string | null;
}

export interface CreateCurrencyRequest {
  code: string;
  name?: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
  is_base: boolean;
  is_active: boolean;
  notes?: string;
}

export interface UpdateCurrencyRequest {
  code: string;
  name?: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
  is_active: boolean;
  notes?: string;
}

export interface SetExchangeRateRequest {
  from_currency: string;
  to_currency: string;
  rate: string;
  rate_type: string;
  rate_date?: string;
  source?: string;
  user_id?: string;
}

export interface CurrencyContextDto {
  base_currency_code: string;
  active_currencies: Currency[];
  today_status: TodayRateStatus[];
  last_updated_at: string | null;
}

export interface WorldCurrency {
  code: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
}
